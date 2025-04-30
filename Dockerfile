FROM node:alpine

WORKDIR /app

# Install Yarn version 4.5.2 globally
RUN npm install -g yarn@4.5.2

# Copy package.json and yarn.lock files
COPY package*.json yarn.lock* ./

# Install project dependencies using the installed Yarn version
RUN yarn install

# Copy the rest of the application files
COPY . .

# Default command to start the application
CMD ["yarn", "start"]
