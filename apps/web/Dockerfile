FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html
COPY static /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
