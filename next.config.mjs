/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Allow requests proxied from nginx on localhost:80
    allowedDevOrigins: ['localhost', '127.0.0.1', '0.0.0.0'],
};

export default nextConfig;
