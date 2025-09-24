import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本番ビルド最適化
  output: 'standalone',
  compress: true,

  // ESLint設定
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // パフォーマンス最適化
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'lucide-react'],
  },


  // 画像最適化
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // バンドル分析（開発時のみ）
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config: any) => {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase',
            chunks: 'all',
          },
        },
      };
      return config;
    },
  }),

  // セキュリティヘッダー
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ],

  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    }
  }
};

export default nextConfig;
