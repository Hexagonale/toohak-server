import { ConfigFactory, Logger } from '@shared';

export class ConfigProvider<T> {
    constructor(private readonly configFactory: ConfigFactory<T>) {}

    private readonly logger = new Logger('ConfigProvider');

    private config?: T;

    public async init(): Promise<T | null> {
        // process.env is a dictionary of environment variables, it is provided by Node.js
        const config = this.configFactory.build(process.env);
        if (!config) {
            this.logger.error('init, cannot build config');

            return null;
        }

        this.config = config;
        return config;
    }

    public getConfig(): T {
        if (!this.config) {
            throw new Error('getConfig, config not initialized');
        }

        return this.config;
    }
}
