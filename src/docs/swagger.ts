import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Futbol Tokens API",
      version: "1.0.0",
      description: "API de futbol tokens 🚀"
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: ["./src/modules/**/*.ts", "./src/routes/*.ts"]
};

export const swaggerSpec = swaggerJsdoc(options);
