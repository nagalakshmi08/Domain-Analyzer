const path = require('path');

module.exports = {
    entry: './public/script.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public'), // Output to the public directory
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
};
