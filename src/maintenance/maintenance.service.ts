import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Maintenance, MaintenanceDocument } from './entities/maintenance.entity';

@Injectable()
export class MaintenanceService {
  private cache: { maintenance: boolean; message: string | null } | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 10000; // 10 seconds

  constructor(
    @InjectModel(Maintenance.name)
    private maintenanceModel: Model<MaintenanceDocument>,
  ) {}

  async getMaintenanceStatus(): Promise<{
    maintenance: boolean;
    message: string | null;
  }> {
    const now = Date.now();

    // Return cached value if still valid
    if (this.cache && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cache;
    }

    // Fetch from database
    let settings = await this.maintenanceModel.findOne().exec();

    // If no settings exist, create default
    if (!settings) {
      settings = await this.maintenanceModel.create({
        isMaintenance: false,
        message: null,
      });
    }

    // Update cache
    this.cache = {
      maintenance: settings.isMaintenance || false,
      message: settings.message || null,
    };
    this.cacheTimestamp = now;

    return this.cache;
  }

  async setMaintenanceMode(
    maintenance: boolean,
    message: string | null = null,
  ): Promise<{ success: boolean; maintenance: boolean; message: string | null }> {
    let settings = await this.maintenanceModel.findOne().exec();

    if (!settings) {
      settings = await this.maintenanceModel.create({
        isMaintenance: maintenance,
        message,
      });
    } else {
      settings.isMaintenance = maintenance;
      settings.message = message;
      await settings.save();
    }

    // Invalidate cache
    this.cache = null;

    return {
      success: true,
      maintenance: settings.isMaintenance,
      message: settings.message,
    };
  }
}
