FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["versaoCsharp.csproj", "./"]
RUN dotnet restore "./versaoCsharp.csproj"
COPY . .
RUN dotnet publish "./versaoCsharp.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/playwright/dotnet:v1.55.0-noble AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:5014
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
EXPOSE 5014
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "versaoCsharp.dll"]
