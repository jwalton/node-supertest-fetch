module.exports = {
    extension: ['ts'],
    require: ['ts-node/register'],
    loader: 'ts-node/esm',
    reporter: 'spec',
    recursive: true,
};
