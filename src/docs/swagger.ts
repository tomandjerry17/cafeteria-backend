import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Cafeteria Ordering API",
      version: "1.0.0",
      description: "API documentation for USTP Cafeteria project",
    },
    servers: [
      { url: "http://localhost:4000", description: "Local dev" },
    ],
  },
  apis: ["./src/routes/*.ts"], // we’ll add JSDoc comments there
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(specs));
}
