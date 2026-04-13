docker build \
  --build-arg VITE_API_BASE_URL=http://92.118.113.6:35028/eList \
  --build-arg VITE_USE_MOCK=false \
  -t elist-ui:latest .