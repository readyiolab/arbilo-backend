# Use Node base image
FROM node:18

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application
COPY . .

# Expose backend port
EXPOSE 5000

# Run the backend
CMD ["npm", "start"]
