/**
 * Generador de boilerplate para nuevos módulos del ERP.
 * Uso: npx plop module
 */

module.exports = function (plop) {
  plop.setGenerator("module", {
    description: "Crea un nuevo módulo ERP completo",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Nombre del módulo (ej: inventory):",
      },
      {
        type: "input",
        name: "NameCapitalized",
        message: "Nombre capitalizado (ej: Inventory):",
      },
      {
        type: "input",
        name: "collectionName",
        message: "Nombre de la colección en Firestore (ej: inventoryItems):",
      },
    ],
    actions: [
      // 1. Tipo TypeScript
      {
        type: "add",
        path: "../web/src/types/{{name}}.ts",
        templateFile: "plop-templates/module/type.ts.hbs",
      },
      // 2. Lista en React
      {
        type: "add",
        path: "../web/src/modules/{{name}}/{{NameCapitalized}}List.tsx",
        templateFile: "plop-templates/module/List.tsx.hbs",
      },
      // 3. Formulario en React
      {
        type: "add",
        path: "../web/src/modules/{{name}}/{{NameCapitalized}}Form.tsx",
        templateFile: "plop-templates/module/Form.tsx.hbs",
      },
      // 4. Cloud Function (si aplica)
      {
        type: "add",
        path: "../functions/src/modules/{{name}}/index.ts",
        templateFile: "plop-templates/module/function.ts.hbs",
      },
    ],
  });
};
