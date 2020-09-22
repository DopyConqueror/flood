/**
 * This service is not per rTorrent session, which is why it does not inherit
 * `BaseService` nor have any use of the per user API ie. `getService()`
 */
import {EventEmitter} from 'events';
import type TypedEmitter from 'typed-emitter';
import type {Disks} from '@shared/types/DiskUsage';
import {isPlatformSupported, diskUsage} from '../util/diskUsage';
import type {SupportedPlatform} from '../util/diskUsage';

export interface DiskUsage {
  id: number;
  disks: Disks;
}

interface DiskUsageEvents {
  DISK_USAGE_CHANGE: (usage: DiskUsage) => void;
  newListener: (event: keyof Omit<DiskUsageEvents, 'newListener' | 'removeListener'>) => void;
  removeListener: (event: keyof Omit<DiskUsageEvents, 'newListener' | 'removeListener'>) => void;
}

const INTERVAL_UPDATE = 10000;

class DiskUsageService extends (EventEmitter as new () => TypedEmitter<DiskUsageEvents>) {
  disks: Disks = [];
  tLastChange = 0;
  interval = 0;
  updateInterval?: NodeJS.Timeout;

  constructor() {
    super();

    if (!isPlatformSupported()) {
      console.log(`warning: DiskUsageService does not support this platform`);
      return;
    }

    // start polling disk usage when the first listener is added
    this.on('newListener', (event) => {
      if (this.listenerCount('DISK_USAGE_CHANGE') === 0 && event === 'DISK_USAGE_CHANGE') {
        this.updateInterval = setInterval(this.updateDisks.bind(this), INTERVAL_UPDATE);
      }
    });

    // stop polling disk usage when the last listener is removed
    this.on('removeListener', (event) => {
      if (
        this.listenerCount('DISK_USAGE_CHANGE') === 0 &&
        event === 'DISK_USAGE_CHANGE' &&
        this.updateInterval != null
      ) {
        clearInterval(this.updateInterval);
      }
    });
  }

  updateDisks() {
    if (!isPlatformSupported()) {
      return Promise.reject();
    }
    return diskUsage[process.platform as SupportedPlatform]().then((disks) => {
      if (disks.length !== this.disks.length || disks.some((d, i) => d.used !== this.disks[i].used)) {
        this.tLastChange = Date.now();
        this.disks = disks;
        this.emit('DISK_USAGE_CHANGE', this.getDiskUsage());
      }
    });
  }

  getDiskUsage(): DiskUsage {
    return {
      id: this.tLastChange,
      disks: this.disks,
    } as const;
  }
}

export default new DiskUsageService();
