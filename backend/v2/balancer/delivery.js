const fs = require('fs');
const path = require('path');
class DeliveryQueue {
    constructor({ deliver, file, retryMs = 1000, limit = 1000 }) {
        this.deliver = deliver;
        this.file = file;
        this.retryMs = retryMs;
        this.limit = limit;
        this.targets = [];
        this.weights = new Map();
        this.pending = [];
        this.running = false;
        this.stopped = false;
        this.metrics = { delivered: 0, failedAttempts: 0, rejected: 0 };
        if (file && fs.existsSync(file))
            this.pending = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    persist() {
        if (!this.file)
            return;
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.pending));
        fs.renameSync(this.file + '.tmp', this.file);
    }
    configure(targets) {
        const next = targets.map(t => ({ ...t, load: Number(t.load) > 0 ? Number(t.load) : 1 }));
        if (JSON.stringify(next.map(t => [t.url, t.load])) !== JSON.stringify(this.targets.map(t => [t.url, t.load])))
            this.weights.clear();
        this.targets = next;
        this.wake();
    }
    choose(excluded) {
        const available = this.targets.filter(t => !excluded.has(t.url));
        if (!available.length)
            return null;
        let selected, total = 0, best = -Infinity;
        for (const target of available) {
            total += target.load;
            const weight = (this.weights.get(target.url) || 0) + target.load;
            this.weights.set(target.url, weight);
            if (weight > best) {
                best = weight;
                selected = target;
            }
        }
        this.weights.set(selected.url, this.weights.get(selected.url) - total);
        return selected;
    }
    enqueue(message) {
        if (this.pending.some(item => item.UID === message.UID))
            return true;
        if (this.pending.length >= this.limit) {
            this.metrics.rejected++;
            return false;
        }
        this.pending.push(message);
        try {
            this.persist();
        }
        catch (error) {
            this.pending.pop();
            throw error;
        }
        this.wake();
        return true;
    }
    wake() { if (this.stopped || this.running)
        return; clearTimeout(this.timer); this.timer = setTimeout(() => this.drain().catch(e => console.error('Cola de entrega:', e.message)), 0); }
    async drain() {
        if (this.running || this.stopped)
            return;
        this.running = true;
        try {
            while (!this.stopped && this.pending.length && this.targets.length) {
                const message = this.pending[0], tried = new Set();
                let delivered = false, target;
                while (!this.stopped && (target = this.choose(tried))) {
                    tried.add(target.url);
                    try {
                        await this.deliver(target, message);
                        delivered = true;
                        break;
                    }
                    catch {
                        this.metrics.failedAttempts++;
                    }
                }
                if (!delivered)
                    break;
                this.pending.shift();
                this.persist();
                this.metrics.delivered++;
            }
        }
        finally {
            this.running = false;
            if (!this.stopped && this.pending.length)
                this.timer = setTimeout(() => this.drain().catch(e => console.error('Cola de entrega:', e.message)), this.retryMs);
        }
    }
    status() { return { ...this.metrics, pending: this.pending.length }; }
    stop() { this.stopped = true; clearTimeout(this.timer); }
}
module.exports = { DeliveryQueue };
