module.exports = {
    apps: [
        {
            name: 'axle-api',
            script: 'src/app.ts',
            interpreter: 'tsx',
            exec_mode: 'cluster_mode',
            watch: true,
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};
