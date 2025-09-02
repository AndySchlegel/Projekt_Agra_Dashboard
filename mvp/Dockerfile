# Stage: final - serve static files via nginx
FROM nginx:alpine
# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy static site
COPY public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
