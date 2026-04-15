import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Futbol Tokens API",
      version: "1.0.0",
      description: "API de futbol tokens 🚀"
    }
  },
  apis: ["./src/routes/*.ts"] // donde van los comentarios
};

export const swaggerSpec = swaggerJsdoc(options);