const { exec } = require('node:child_process');
const os = require('node:os');

class SystemService {
  constructor({ emit }) {
    this.emit = emit;
  }

  async getGpuInfo() {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') {
        return resolve({ hasDedicated: false, gpus: [] });
      }

      // Use PowerShell for reliable hardware info
      const cmd = 'powershell "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"';
      exec(cmd, (error, stdout) => {
        if (error || !stdout) {
          return resolve({ hasDedicated: false, gpus: [] });
        }

        try {
          const raw = JSON.parse(stdout);
          const data = Array.isArray(raw) ? raw : [raw];
          const gpus = data.map(item => {
            const name = item.Name || 'Unknown GPU';
            const ram = parseInt(item.AdapterRAM) || 0;
            
            // Dedicated if it's NVIDIA/AMD/Radeon or has significant VRAM
            const isDedicated = /NVIDIA|AMD|Radeon/i.test(name) || ram > 1.5 * 1024 * 1024 * 1024;
            
            return { name, ram: Math.round(ram / (1024 * 1024)), isDedicated };
          });

          const hasDedicated = gpus.some(gpu => gpu.isDedicated);
          resolve({ hasDedicated, gpus });
        } catch {
          resolve({ hasDedicated: false, gpus: [] });
        }
      });
    });
  }

  async getCpuInfo() {
    const cpu = os.cpus()[0].model;
    const isLegacy = cpu.includes('i3-2') || cpu.includes('Sandy Bridge');
    return { model: cpu, isLegacy };
  }
}

module.exports = { SystemService };
