import { ConfigFactory, Dictionary, Logger } from '@shared';

import { Config } from './config';

export class AuthenticationConfigFactory implements ConfigFactory<Config> {
    private readonly logger = new Logger('AuthenticationConfigFactory');

    public build(raw: Dictionary<string>): Config | null {
        const portRaw = raw.PORT;
        if (!portRaw) {
            this.logger.error('build, cannot find PORT in env');

            return null;
        }

        const port = parseInt(portRaw, 10);
        if (Number.isNaN(port)) {
            this.logger.error(`build, cannot parse PORT: ${portRaw}`);

            return null;
        }

        const fullchainPath = raw.FULLCHAIN_PATH;
        if (!fullchainPath) {
            this.logger.error('build, cannot find FULLCHAIN_PATH in env');

            return null;
        }

        const privkeyPath = raw.PRIVKEY_PATH;
        if (!privkeyPath) {
            this.logger.error('build, cannot find PRIVKEY_PATH in env');

            return null;
        }

        return {
            port,
            fullchainPath,
            privkeyPath,
        };
    }
}
