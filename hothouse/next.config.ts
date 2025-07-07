/** @type {import('next').NextConfig} */

import type { NextConfig } from 'next'

import { loadEnvConfig } from '@next/env'
import crypto from 'crypto'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

const projectDir = process.cwd()
loadEnvConfig(projectDir)

let buildId = process.env.NEXT_PUBLIC_APP_BUILD_ID || ''

if (!buildId && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_BUILD_ID is not set')
} else {
    if (process.env.NODE_ENV !== 'development') {
        console.warn(
            'Generating build ID! This should only happen in development, but NODE_ENV IS',
            process.env.NODE_ENV
        )
    }
    buildId = crypto.randomBytes(8).toString('hex')
}

const config = (phase: string): NextConfig => {
    const dev = phase === PHASE_DEVELOPMENT_SERVER

    return {
        eslint: {
            ignoreDuringBuilds: dev,
        },
        productionBrowserSourceMaps: true,
        reactStrictMode: true,
        output: dev ? undefined : 'standalone',
        assetPrefix: process.env.NEXT_PUBLIC_STATIC_ASSET_PATH || undefined,
        generateBuildId: async () => buildId,
        images: {
            disableStaticImages: false,
            remotePatterns: [],
        },
    }
}

export default config
