import type { Category, CreateExpensePayload, Expense, PaymentSource } from "./api";

export const csvImportTag = "csv";

const headers = [
  "Date",
  "Merchant",
  "Category",
  "Subcategory",
  "Payment source",
  "Amount",
  "Currency",
  "Converted amount",
  "Converted currency",
  "Notes",
  "Tags"
];

function csvField(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvText(value: string | null | undefined) {
  const text = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return csvField(safe);
}

function amount(minor: number) {
  return (minor / 100).toFixed(2);
}

export function expensesToCsv(expenses: Expense[], categories: Category[], paymentSources: PaymentSource[]) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const paymentNames = new Map(paymentSources.map((source) => [source.id, source.name]));
  const lines = expenses.map((expense) =>
    [
      csvField(expense.expense_date.slice(0, 10)),
      csvText(expense.merchant),
      csvText(categoryNames.get(expense.category_id) ?? ""),
      csvText(expense.subcategory_name),
      csvText(paymentNames.get(expense.payment_source_id) ?? ""),
      amount(expense.original_amount_minor),
      csvField(expense.original_currency_code),
      amount(expense.converted_amount_minor),
      csvField(expense.converted_currency_code),
      csvText(expense.notes),
      csvText((expense.tags ?? []).join("; "))
    ].join(",")
  );
  return [headers.join(","), ...lines].join("\r\n");
}

export function expenseCsvFilename(dateFrom: string, dateTo: string) {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (!from && !to) return "pennywise-expenses.csv";
  return `pennywise-expenses-${from || "start"}-to-${to || "end"}.csv`;
}

function parseCsvTable(text: string) {
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;

  const pushRow = () => {
    if (cells.some((cell) => cell.trim() !== "") || field.trim() !== "") {
      rows.push({ line, cells: [...cells, field] });
    }
    cells = [];
    field = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
        if (char === "\n") line += 1;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      cells.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      pushRow();
      line += 1;
      continue;
    }
    field += char;
  }
  if (field.length > 0 || cells.length > 0) pushRow();
  return rows;
}

function headerName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function plainText(value: string) {
  const text = value.trim();
  if (text.startsWith("'") && /^[=+\-@\t]/.test(text.slice(1))) return text.slice(1);
  return text;
}

function parseDate(value: string) {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/.exec(text);
  const year = iso?.[1] ?? local?.[3];
  const month = iso?.[2] ?? local?.[2]?.padStart(2, "0");
  const day = iso?.[3] ?? local?.[1]?.padStart(2, "0");
  if (!year || !month || !day) return "";
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) {
    return "";
  }
  return date;
}

function parseAmountMinor(value: string) {
  const cleaned = value.trim().replace(/[₹$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

function findNamed<T extends { name: string }>(items: T[], name: string) {
  const key = name.trim().toLowerCase();
  return items.filter((item) => item.name.trim().toLowerCase() === key);
}

function importTags(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of [...value.split(";"), csvImportTag]) {
    const tag = part.trim().replace(/^#/, "");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag.slice(0, 80));
  }
  return tags;
}

function referenceRow(category: string, subcategory: string) {
  return ["", "", category, subcategory, "", "", "", "", ""].map(csvField).join(",");
}

export function sampleExpensesCsv(categories: Category[], paymentSources: PaymentSource[], tags: string[], date: string) {
  const sampleDate = parseDate(date) || "2026-10-01";
  const activeCategories = categories.filter((category) => category.name.trim());
  const firstCategory = activeCategories[0];
  const firstSubcategory = (firstCategory?.subcategories ?? []).find((item) => !item.deleted && item.name.trim());
  const payment = paymentSources.find((source) => source.name.trim());
  const tagNames = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (!tagNames.some((tag) => tag.toLowerCase() === csvImportTag)) tagNames.push(csvImportTag);
  const lines = [["Date", "Merchant", "Category", "Subcategory", "Payment source", "Amount", "Currency", "Notes", "Tags"].join(",")];
  lines.push(
    csvField(
      `# Example: ${sampleDate}, Sample store, ${firstCategory?.name ?? "Food"}, ${firstSubcategory?.name ?? ""}, ${payment?.name ?? "Cash"}, 250.00, ${payment?.currency_code || "INR"}, notes, ${tagNames.slice(0, 3).join("; ")}`
    )
  );
  lines.push(csvField("# Fill Date, Merchant, Payment source, and Amount on a row below to add it. Rows without those are only a reference."));
  lines.push(csvField(`# Tags: ${tagNames.join("; ")}`));
  lines.push(
    csvField(
      `# Payment sources: ${
        paymentSources
          .filter((source) => source.name.trim())
          .map((source) => `${source.name} (${source.currency_code})`)
          .join("; ") || "none yet"
      }`
    )
  );

  activeCategories.forEach((category) => {
    const subcategories = (category.subcategories ?? []).filter((item) => !item.deleted && item.name.trim());
    if (subcategories.length === 0) {
      lines.push(referenceRow(category.name, ""));
      return;
    }
    subcategories.forEach((subcategory) => lines.push(referenceRow(category.name, subcategory.name)));
  });
  return lines.join("\r\n");
}

export function expensesFromCsv(text: string, categories: Category[], paymentSources: PaymentSource[]) {
  const table = parseCsvTable(text);
  const errors: string[] = [];
  const payloads: CreateExpensePayload[] = [];
  if (table.length === 0) {
    return { payloads, errors: ["The CSV is empty."] };
  }

  const header = table[0].cells.map(headerName);
  const column = (name: string) => header.indexOf(name);
  const missing = ["date", "category", "payment source", "amount"].filter((name) => column(name) < 0);
  if (missing.length > 0) {
    return { payloads, errors: [`The CSV is missing ${missing.join(", ")}. Download the sample CSV for the expected columns.`] };
  }

  const importRows = table.slice(1).filter((row) => {
    const raw = (name: string) => (column(name) >= 0 ? (row.cells[column(name)] ?? "") : "").trim();
    if ((row.cells[0] ?? "").trim().startsWith("#")) return false;
    return Boolean(raw("date") || raw("merchant") || raw("amount"));
  });
  if (importRows.length === 0) {
    return { payloads, errors: ["The CSV has no expenses to add."] };
  }
  if (importRows.length > 500) {
    return { payloads, errors: ["A CSV upload can add at most 500 expenses."] };
  }

  importRows.forEach((row) => {
    const cell = (name: string) => plainText(column(name) >= 0 ? (row.cells[column(name)] ?? "") : "");
    const where = `Line ${row.line}`;
    const date = parseDate(cell("date"));
    const categoryName = cell("category");
    const subcategoryName = cell("subcategory");
    const paymentName = cell("payment source");
    const amountMinor = parseAmountMinor(cell("amount"));
    const currency = cell("currency").toUpperCase();
    const rowErrors: string[] = [];

    if (!date) rowErrors.push(`${where}: date must be YYYY-MM-DD.`);
    if (!categoryName) rowErrors.push(`${where}: category is required.`);
    if (!paymentName) rowErrors.push(`${where}: payment source is required.`);
    if (amountMinor === null) rowErrors.push(`${where}: amount must be greater than zero, such as 250.00.`);
    if (currency && !/^[A-Z]{3}$/.test(currency)) rowErrors.push(`${where}: currency must be a 3-letter code.`);

    const categoryMatches = findNamed(categories, categoryName);
    if (categoryName && categoryMatches.length === 0) rowErrors.push(`${where}: category ${categoryName} was not found.`);
    if (categoryMatches.length > 1) rowErrors.push(`${where}: more than one category is named ${categoryName}.`);
    const category = categoryMatches.length === 1 ? categoryMatches[0] : undefined;
    const activeSubcategories = (category?.subcategories ?? []).filter((item) => !item.deleted);
    let subcategoryID: number | undefined;
    if (category && activeSubcategories.length > 0) {
      if (!subcategoryName) {
        rowErrors.push(`${where}: ${category.name} needs a subcategory.`);
      } else {
        const matches = findNamed(activeSubcategories, subcategoryName);
        if (matches.length === 0) rowErrors.push(`${where}: subcategory ${subcategoryName} was not found for ${category.name}.`);
        if (matches.length > 1) rowErrors.push(`${where}: more than one subcategory is named ${subcategoryName}.`);
        subcategoryID = matches.length === 1 ? matches[0].id : undefined;
      }
    } else if (category && subcategoryName) {
      rowErrors.push(`${where}: ${category.name} has no subcategory.`);
    }

    const paymentMatches = findNamed(paymentSources, paymentName);
    if (paymentName && paymentMatches.length === 0) rowErrors.push(`${where}: payment source ${paymentName} was not found.`);
    if (paymentMatches.length > 1) rowErrors.push(`${where}: more than one payment source is named ${paymentName}.`);
    const payment = paymentMatches.length === 1 ? paymentMatches[0] : undefined;
    const currencyCode = currency || payment?.currency_code || "";
    if (!currencyCode) rowErrors.push(`${where}: currency is required.`);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    if (!category || !payment || amountMinor === null || !date) return;

    payloads.push({
      expense_date: date,
      merchant: cell("merchant"),
      category_id: category.id,
      ...(subcategoryID ? { subcategory_id: subcategoryID } : {}),
      payment_source_id: payment.id,
      original_amount_minor: amountMinor,
      original_currency_code: currencyCode,
      notes: cell("notes"),
      tags: importTags(cell("tags"))
    });
  });

  return { payloads, errors };
}
