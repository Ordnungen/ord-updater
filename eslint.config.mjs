import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
    {
        // Артефакты и служебные скрипты не линтуем: main.js — результат сборки,
        // .cache — собранные инструменты (проверки и отчёт по хранилищу).
        ignores: ["main.js", ".cache/**", "esbuild.config.mjs", "version-bump.mjs", "node_modules/**"],
    },
    ...obsidianmd.configs.recommended,
    {
        files: ["src/**/*.ts", "tools/**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: { allowDefaultProject: ["eslint.config.mjs"] },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Отключать правила можно только точечно и с причиной в комментарии.
        },
    },
    {
        // Проверки запускаются в Node на машине разработчика, а не в Obsidian:
        // вывод в консоль и файловые API — их назначение.
        files: ["tools/**/*.ts"],
        languageOptions: {
            globals: {
                process: "readonly",
                console: "readonly",
                setImmediate: "readonly",
                Date: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
            },
        },
        rules: {
            "no-console": "off",
            "obsidianmd/rule-custom-message": "off",
            "obsidianmd/no-nodejs-modules": "off", // причина: инструмент работает в Node, а не в Obsidian
            "obsidianmd/hardcoded-config-path": "off", // причина: проверки подставляют фиктивные пути хранилища
            "obsidianmd/no-global-this": "off", // причина: в Node окно доступно только как globalThis
            "obsidianmd/no-tfile-tfolder-cast": "off", // причина: проверки строят поддельные файлы и папки
            "obsidianmd/no-plugin-as-component": "off", // причина: проверки создают плагин напрямую, без PluginManager
            // Причина: проверки явно называют тип поддельного файла (TFile/TFolder),
            // иначе компилятор теряет его в объединении TAbstractFile.
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
            // Причина: заглушка повторяет API Obsidian целиком, включая Vault.delete,
            // которую настоящий плагин не вызывает.
            "obsidianmd/prefer-file-manager-trash-file": "off",
        },
    },
]);
