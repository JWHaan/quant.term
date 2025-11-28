import { IIndicatorPlugin } from '../../types/Plugin';

export class PluginManager {
    private plugins: Map<string, IIndicatorPlugin> = new Map();

    register(plugin: IIndicatorPlugin) {
        if (this.plugins.has(plugin.id)) {
            console.warn(`Plugin ${plugin.id} is already registered. Overwriting.`);
        }
        this.plugins.set(plugin.id, plugin);
        console.log(`Plugin registered: ${plugin.name} (${plugin.version})`);
    }

    unregister(pluginId: string) {
        this.plugins.delete(pluginId);
    }

    getPlugin(pluginId: string): IIndicatorPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    getAllPlugins(): IIndicatorPlugin[] {
        return Array.from(this.plugins.values());
    }

    executePlugin(pluginId: string, ...args: any[]): any {
        const plugin = this.getPlugin(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        return plugin.calculate.apply(plugin, args as [any, any]);
    }
}

export const pluginManager = new PluginManager();
