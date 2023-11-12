import { Dictionary } from '@shared';

export interface ConfigFactory<T> {
    build(raw: Dictionary<string>): T | null;
}
