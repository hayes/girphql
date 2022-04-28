// @ts-nocheck
import './global-types.ts';
import { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { BasePlugin, PothosOutputFieldConfig, SchemaTypes } from '../core/index.ts';
const pluginName = "tracing" as const;
export default pluginName;
export * from './types.ts';
export * from './util.ts';
export class PothosTracingPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        if (!this.builder.options.tracing) {
            return resolver;
        }
        const { wrap, default: defaultConfig } = this.builder.options.tracing;
        const tracingValue = fieldConfig.pothosOptions.tracing ??
            (typeof defaultConfig === "function"
                ? (defaultConfig as (config: PothosOutputFieldConfig<Types>) => Types["Tracing"])(fieldConfig)
                : defaultConfig);
        const tracingFn = wrap(fieldConfig, tracingValue);
        if (!tracingFn) {
            return resolver;
        }
        return (source, args, context, info) => tracingFn(() => resolver(source, args, context, info) as never, source, args as {}, context, info);
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosTracingPlugin);