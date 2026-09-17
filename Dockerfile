# Pinned: node:25+ images no longer bundle Yarn. 22 is LTS and ships yarn 1.x.
FROM node:22-alpine

# Install required dependencies for node-canvas and node-gyp
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  cairo-dev \
  jpeg-dev \
  pango-dev \
  giflib-dev \
  pixman-dev \
  fontconfig \
  ttf-dejavu \
  ttf-freefont

# Set Python for node-gyp explicitly (optional but helps)
ENV PYTHON=/usr/bin/python3
# canvas is compiled from source on Alpine (no musl prebuilt); GCC 15 no longer
# includes <cstdint> implicitly, so force it or the build fails on uint8_t
ENV CXXFLAGS="-include cstdint"

WORKDIR /app

# Copy package.json and yarn.lock files
COPY package*.json yarn.lock* ./

# Install runtime dependencies only (dev deps include mongodb-memory-server,
# which downloads a mongod binary that does not exist for Alpine)
RUN yarn install --production --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Default command to start the application
CMD ["yarn", "start"]
