// @ts-nocheck
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import SchemaBuilder, { createContextCache, InterfaceParam, OutputShape, SchemaTypes, } from '../core/index.ts';
import { DataloaderObjectTypeOptions } from './types.ts';
import { LoadableObjectRef } from './util.ts';
const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;
schemaBuilderProto.loadableObject = function loadableObject<Interfaces extends InterfaceParam<SchemaTypes>[], Shape extends OutputShape<SchemaTypes, Interfaces[number]> & object, Key extends bigint | number | string, CacheKey = Key>(name: string, { load, loaderOptions, ...options }: DataloaderObjectTypeOptions<SchemaTypes, Interfaces, Shape, Key, CacheKey>) {
    const getDataloader = createContextCache((context: SchemaTypes["Context"]) => new DataLoader<Key, Shape, CacheKey>((keys: readonly Key[]) => (load as (keys: readonly Key[], context: SchemaTypes["Context"]) => Promise<Shape[]>)(keys, context), loaderOptions));
    const ref = new LoadableObjectRef<SchemaTypes, Shape, Shape, Key, CacheKey>(this, name, getDataloader);
    ref.implement({
        ...options,
        extensions: {
            getDataloader,
        },
    });
    return ref;
};