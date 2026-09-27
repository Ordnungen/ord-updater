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
            // Набор, который включает сканер сообщества. Держим его включённым и
            // в коде плагина: так наша проверка ловит то же, что и он.
            "@typescript-eslint/no-unsafe-assignment": "error",
            "@typescript-eslint/no-unsafe-member-access": "error",
            "@typescript-eslint/no-unsafe-call": "error",
            "@typescript-eslint/no-unsafe-argument": "error",
            "@typescript-eslint/no-unsafe-return": "error",
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
            // `no-console` включён и для инструментов: отчёт идёт в поток
            // (tools/output.ts), а перехват журнала плагина в проверках помечен
            // точечным eslint-disable с причиной.
            // Набор, который включает сканер сообщества: если он молчит у нас,
            // значит и там замечаний по типам не будет.
            "@typescript-eslint/no-unsafe-assignment": "error",
            "@typescript-eslint/no-unsafe-member-access": "error",
            "@typescript-eslint/no-unsafe-call": "error",
            "@typescript-eslint/no-unsafe-argument": "error",
            "@typescript-eslint/no-unsafe-return": "error",
            "obsidianmd/rule-custom-message": "off",
            "obsidianmd/no-nodejs-modules": "error", // те же правила, что в проверке сообщества: инструменты берут модули Node только под проверкой платформы
            "obsidianmd/hardcoded-config-path": "off", // причина: проверки подставляют фиктивные пути хранилища
            "obsidianmd/no-global-this": "error", // то же правило сообщества: в инструментах окна нет, поэтому глобальный объект берём явно и объясняем это
            "obsidianmd/no-tfile-tfolder-cast": "off", // причина: проверки строят поддельные файлы и папки
            "obsidianmd/no-plugin-as-component": "off", // причина: проверки создают плагин напрямую, без PluginManager
            // Причина: проверки явно называют тип поддельного файла (TFile/TFolder),
            // иначе компилятор теряет его в объединении TAbstractFile.
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
            // Причина: заглушка повторяет API Obsidian целиком, включая Vault.delete,
            // которую настоящий плагин не вызывает.
            "obsidianmd/prefer-file-manager-trash-file": "off",
            // Причина: заглушка печатает значения свойств в YAML, любое из них
            // нужно привести к тексту.
            "@typescript-eslint/no-base-to-string": "off",
        },
    },
]);
