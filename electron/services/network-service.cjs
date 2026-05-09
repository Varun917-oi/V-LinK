const os = require('node:os');
const net = require('node:net');

class NetworkService {
  constructor({ adb, emit }) {
    this.adb = adb;
    this.emit = emit;
  }

  log(message, level = 'info') {
    this.emit('logs:changed', { level, message, at: new Date().toISOString() });
  }

  localSubnets() {
    return Object.values(os.networkInterfaces())
      .flat()
      .filter((item) => item && item.family === 'IPv4' && !item.internal)
      .map((item) => item.address.split('.').slice(0, 3).join('.'));
  }

  probe(host, port, timeout = 160) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;
      const finish = (open) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(open);
      };
      socket.setTimeout(timeout);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, host);
    });
  }

  async scan(port = 5555) {
    const subnets = this.localSubnets();
    const hosts = subnets.flatMap((subnet) => Array.from({ length: 254 }, (_, index) => `${subnet}.${index + 1}`));
    const found = [];
    const limit = 64;
    for (let i = 0; i < hosts.length; i += limit) {
      const batch = hosts.slice(i, i + limit);
      const results = await Promise.all(batch.map(async (host) => ({ host, open: await this.probe(host, port) })));
      found.push(...results.filter((result) => result.open).map((result) => ({ ...result, port })));
      this.emit('metrics:changed', { scanProgress: Math.min(100, Math.round(((i + batch.length) / hosts.length) * 100)) });
    }
    this.log(`Wireless scan found ${found.length} ADB endpoint${found.length === 1 ? '' : 's'}`);
    return found;
  }
}

module.exports = { NetworkService };
