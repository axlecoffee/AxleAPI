module.exports = {
    apps: [
        {
            name: 'axle-api',
            script: 'src/app.ts',
            interpreter: 'tsx',
            cwd: "/home/axle/axlecoffee/API",
            exec_mode: 'fork',
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
