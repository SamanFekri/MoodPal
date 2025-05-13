FROM node:alpine

# Install required dependencies for node-canvas and node-gyp
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  cairo-dev \
  jpeg-dev \
  pango-dev \
  giflib-dev \
  pixman-dev

# Set Python for node-gyp explicitly (optional but helps)
ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Copy package.json and yarn.lock files
COPY package*.json yarn.lock* ./

# Install project dependencies using the installed Yarn version
RUN yarn install

# Copy the rest of the application files
COPY . .

# Default command to start the application
CMD ["yarn", "start"]
