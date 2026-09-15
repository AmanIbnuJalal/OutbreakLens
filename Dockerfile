FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY scripts ./scripts
COPY lib ./lib
COPY artifacts ./artifacts

# Install dependencies
RUN pnpm install --frozen-lockfile

# We will run this container with different commands from compose
