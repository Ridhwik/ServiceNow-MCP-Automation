#!/usr/bin/env node
/**
 * ServiceNow Ultra MCP Server
 * Covers: Tables, Fields, Business Rules, Client Scripts, UI Actions, UI Pages,
 *         Script Includes, Notifications, Flows, Portals, Widgets, ACLs,
 *         Scheduled Jobs, Transform Maps, Record Producers, Properties,
 *         Roles, Groups, Update Sets, Records (CRUD)
 */

const https = require("https");
const http = require("http");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SN_INSTANCE = process.env.SN_INSTANCE ;
const SN_USERNAME = process.env.SN_USERNAME ;
const SN_PASSWORD = process.env.SN_PASSWORD ;
// ──────────────────────────────────────────────────────────────────────────────

const AUTH = Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString("base64");

function snRequest(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(SN_INSTANCE + path);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...extraHeaders,
      },
    };
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function ok(r) {
  if (r.status >= 200 && r.status < 300) return r.body?.result;
  throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.body)}`);
}

// ─── TOOL DEFINITIONS ─────────────────────────────────────────────────────────
const TOOLS = [

  // ── RECORDS (CRUD) ──────────────────────────────────────────────────────────
  {
    name: "create_record",
    description: "Create any record in any ServiceNow table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name e.g. incident, sc_request, u_my_table" },
        fields: { type: "object", description: "Key-value field pairs" },
      },
      required: ["table", "fields"],
    },
  },
  {
    name: "get_records",
    description: "Query records from any ServiceNow table with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        query: { type: "string", description: "Encoded query e.g. active=true^priority=1" },
        limit: { type: "number" },
        fields: { type: "string", description: "Comma-separated fields to return" },
      },
      required: ["table"],
    },
  },
  {
    name: "update_record",
    description: "Update an existing record by sys_id",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        sys_id: { type: "string" },
        fields: { type: "object" },
      },
      required: ["table", "sys_id", "fields"],
    },
  },
  {
    name: "delete_record",
    description: "Delete a record by sys_id",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        sys_id: { type: "string" },
      },
      required: ["table", "sys_id"],
    },
  },

  // ── TABLE & SCHEMA ───────────────────────────────────────────────────────────
  {
    name: "create_custom_table",
    description: "Create a new custom application table in ServiceNow",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Human-readable label e.g. Fleet Vehicle" },
        name: { type: "string", description: "Table name without u_ prefix e.g. fleet_vehicle" },
        extends_table: { type: "string", description: "Parent table e.g. task, incident (optional)" },
        auto_number: { type: "boolean", description: "Enable auto-numbering" },
        number_prefix: { type: "string", description: "Auto-number prefix e.g. FRC, MNT" },
      },
      required: ["label", "name"],
    },
  },
  {
    name: "add_field_to_table",
    description: "Add a field/column to any ServiceNow table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        label: { type: "string" },
        name: { type: "string", description: "Element name without u_ prefix" },
        type: { type: "string", description: "string | integer | boolean | decimal | date | datetime | reference | choice | html | url | email | phone_number | currency | glide_duration | list" },
        max_length: { type: "number" },
        reference_table: { type: "string", description: "For reference fields e.g. sys_user" },
        mandatory: { type: "boolean" },
        default_value: { type: "string" },
        choices: {
          type: "array",
          description: "For choice fields: [{label, value}]",
          items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } } },
        },
      },
      required: ["table", "label", "name", "type"],
    },
  },
  {
    name: "get_table_schema",
    description: "Get all fields/columns of a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
      },
      required: ["table"],
    },
  },

  // ── BUSINESS RULES ───────────────────────────────────────────────────────────
  {
    name: "create_business_rule",
    description: "Create a Business Rule with full server-side JavaScript",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        table: { type: "string" },
        when: { type: "string", enum: ["before", "after", "async", "display"] },
        insert: { type: "boolean" },
        update: { type: "boolean" },
        delete: { type: "boolean" },
        query: { type: "boolean" },
        script: { type: "string" },
        condition: { type: "string" },
        filter_condition: { type: "string", description: "Encoded query condition for when BR fires" },
        order: { type: "number", description: "Execution order (100 = default)" },
        active: { type: "boolean" },
      },
      required: ["name", "table", "when", "script"],
    },
  },

  // ── CLIENT SCRIPTS ───────────────────────────────────────────────────────────
  {
    name: "create_client_script",
    description: "Create a Client Script (onLoad, onChange, onSubmit, onCellEdit)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        table: { type: "string" },
        type: { type: "string", enum: ["onLoad", "onChange", "onSubmit", "onCellEdit"] },
        script: { type: "string" },
        field_name: { type: "string", description: "Field for onChange scripts" },
        ui_type: { type: "string", enum: ["desktop", "mobile", "all"], description: "UI type (default: all)" },
        active: { type: "boolean" },
      },
      required: ["name", "table", "type", "script"],
    },
  },

  // ── UI ACTIONS ───────────────────────────────────────────────────────────────
  {
    name: "create_ui_action",
    description: "Create a UI Action (form button, list button, context menu item)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        table: { type: "string", description: "Table name or 'global' for all tables" },
        action_name: { type: "string", description: "Internal action name (no spaces)" },
        script: { type: "string", description: "Client-side JS (for client=true) or server-side" },
        client: { type: "boolean", description: "True = client-side button" },
        form_button: { type: "boolean" },
        form_context_menu: { type: "boolean" },
        list_banner_button: { type: "boolean" },
        list_context_menu: { type: "boolean" },
        show_insert: { type: "boolean" },
        show_update: { type: "boolean" },
        condition: { type: "string" },
        hint: { type: "string", description: "Tooltip hint text" },
        active: { type: "boolean" },
        order: { type: "number" },
      },
      required: ["name", "table", "action_name", "script"],
    },
  },

  // ── UI PAGES ─────────────────────────────────────────────────────────────────
  {
    name: "create_ui_page",
    description: "Create a UI Page (Jelly/HTML page for modals, custom views)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        html: { type: "string", description: "Jelly HTML template content" },
        client_script: { type: "string", description: "Client-side JS" },
        processing_script: { type: "string", description: "Server-side processing script" },
        direct: { type: "boolean", description: "Direct URL accessible" },
        category: { type: "string", description: "e.g. general, service_portal" },
      },
      required: ["name", "html"],
    },
  },

  // ── SCRIPT INCLUDES ──────────────────────────────────────────────────────────
  {
    name: "create_script_include",
    description: "Create a Script Include (reusable server-side JS class/utility)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Class name e.g. MyProcessor" },
        script: { type: "string", description: "Full script include code including class definition" },
        client_callable: { type: "boolean", description: "True = accessible via GlideAjax" },
        description: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["name", "script"],
    },
  },

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────────
  {
    name: "create_notification",
    description: "Create an email notification",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        table: { type: "string" },
        subject: { type: "string" },
        body: { type: "string", description: "HTML email body (supports ${field_name} variables)" },
        when: { type: "string", enum: ["insert", "update", "insert_or_update"] },
        condition: { type: "string" },
        recipients: { type: "string", description: "Comma-separated user sys_ids or email addresses" },
        recipient_fields: { type: "string", description: "Field on record containing user reference e.g. assigned_to" },
        active: { type: "boolean" },
      },
      required: ["name", "table", "subject", "body", "when"],
    },
  },

  // ── SCHEDULED JOBS ───────────────────────────────────────────────────────────
  {
    name: "create_scheduled_job",
    description: "Create a Scheduled Script Execution (cron job)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        script: { type: "string" },
        run_type: { type: "string", enum: ["daily", "weekly", "monthly", "periodically", "once", "on_demand"], description: "Frequency" },
        run_time: { type: "string", description: "Time to run e.g. 07:00:00 for 7AM" },
        run_day_of_week: { type: "string", description: "For weekly: 0=Sun,1=Mon...6=Sat" },
        run_period: { type: "string", description: "For periodically: e.g. 00:30:00 for 30 min" },
        active: { type: "boolean" },
      },
      required: ["name", "script", "run_type"],
    },
  },

  // ── ACLs ─────────────────────────────────────────────────────────────────────
  {
    name: "create_acl",
    description: "Create an Access Control Rule (ACL) for table/field level security",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        table: { type: "string" },
        operation: { type: "string", enum: ["read", "write", "create", "delete"], description: "Operation to control" },
        field: { type: "string", description: "Field name for field-level ACL (leave empty for table-level)" },
        roles: { type: "string", description: "Comma-separated role names that ARE allowed e.g. admin,itil" },
        condition: { type: "string", description: "Optional condition script" },
        script: { type: "string", description: "Optional advanced script" },
        active: { type: "boolean" },
      },
      required: ["name", "table", "operation"],
    },
  },

  // ── ROLES & GROUPS ───────────────────────────────────────────────────────────
  {
    name: "create_role",
    description: "Create a custom application role",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Role name e.g. x_myapp.logistics_director" },
        description: { type: "string" },
        assignable_by: { type: "string", description: "Role required to grant this role" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_group",
    description: "Create a user group and optionally assign roles",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        roles: { type: "array", items: { type: "string" }, description: "Role names to assign to group" },
        manager: { type: "string", description: "User sys_id as manager" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_user_to_group",
    description: "Add a user to a group",
    inputSchema: {
      type: "object",
      properties: {
        user_sys_id: { type: "string" },
        group_name: { type: "string" },
      },
      required: ["user_sys_id", "group_name"],
    },
  },

  // ── APP PROPERTIES ───────────────────────────────────────────────────────────
  {
    name: "create_system_property",
    description: "Create a System Property (application configuration value)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Property name e.g. myapp.tax.rate" },
        value: { type: "string" },
        description: { type: "string" },
        type: { type: "string", enum: ["string", "integer", "boolean", "date", "password", "list"], description: "Property type" },
        suffix: { type: "string", description: "Category suffix for grouping" },
      },
      required: ["name", "value"],
    },
  },

  // ── SERVICE PORTAL ───────────────────────────────────────────────────────────
  {
    name: "create_portal",
    description: "Create a Service Portal",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        url_suffix: { type: "string", description: "URL path e.g. fco_gateway (no slashes)" },
        description: { type: "string" },
        homepage_sys_id: { type: "string", description: "sys_id of the page to use as homepage (optional)" },
        css_variables: { type: "string", description: "Custom CSS variables/overrides" },
        login_page: { type: "string", description: "Login page sys_id or name (optional)" },
      },
      required: ["title", "url_suffix"],
    },
  },
  {
    name: "create_portal_page",
    description: "Create a Service Portal Page",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        id: { type: "string", description: "Page ID/URL slug e.g. home, landing" },
        portal_sys_id: { type: "string", description: "sys_id of the parent portal" },
        description: { type: "string" },
      },
      required: ["title", "id", "portal_sys_id"],
    },
  },
  {
    name: "create_widget",
    description: "Create a Service Portal Widget with server script, client controller, HTML, CSS",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        id: { type: "string", description: "Widget ID (no spaces) e.g. my-tracking-widget" },
        template: { type: "string", description: "Angular HTML template" },
        css: { type: "string", description: "Widget-scoped SCSS/CSS" },
        server_script: { type: "string", description: "Server-side GlideRecord script (data object)" },
        client_script: { type: "string", description: "Angular client controller JS" },
        option_schema: { type: "string", description: "JSON option schema for widget configuration" },
        has_preview: { type: "boolean" },
      },
      required: ["name", "id", "template"],
    },
  },
  {
    name: "add_widget_to_page",
    description: "Add a widget to a portal page in a specific container/row/column",
    inputSchema: {
      type: "object",
      properties: {
        page_sys_id: { type: "string" },
        widget_sys_id: { type: "string" },
        order: { type: "number", description: "Display order" },
      },
      required: ["page_sys_id", "widget_sys_id"],
    },
  },

  // ── FLOWS / FLOW DESIGNER ────────────────────────────────────────────────────
  {
    name: "create_flow",
    description: "Create a Flow Designer flow (record-triggered or schedule-triggered)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        trigger_type: { type: "string", enum: ["record", "schedule", "application", "inbound_email"], description: "Trigger type" },
        trigger_table: { type: "string", description: "Table for record trigger e.g. incident" },
        trigger_condition: { type: "string", description: "When condition e.g. insert, update, insert_or_update" },
        active: { type: "boolean" },
      },
      required: ["name", "trigger_type"],
    },
  },

  // ── TRANSFORM MAPS ───────────────────────────────────────────────────────────
  {
    name: "create_transform_map",
    description: "Create a Transform Map for data import",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        source_table: { type: "string", description: "Import set table (staging table)" },
        target_table: { type: "string", description: "Target table to insert/update into" },
        coalesce_fields: { type: "string", description: "Comma-separated fields to use as unique key for upsert" },
        run_business_rules: { type: "boolean" },
        on_before_script: { type: "string", description: "Script to run before each row transform" },
        on_after_script: { type: "string", description: "Script to run after each row transform" },
      },
      required: ["name", "source_table", "target_table"],
    },
  },

  // ── RECORD PRODUCERS ─────────────────────────────────────────────────────────
  {
    name: "create_record_producer",
    description: "Create a Record Producer (catalog item that creates records)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        table: { type: "string", description: "Table where record will be created" },
        short_description: { type: "string" },
        script: { type: "string", description: "Script to run on submission" },
        category: { type: "string", description: "Catalog category name" },
        roles: { type: "string", description: "Comma-separated roles that can see this" },
      },
      required: ["name", "table", "short_description"],
    },
  },

  // ── UPDATE SETS ──────────────────────────────────────────────────────────────
  {
    name: "create_update_set",
    description: "Create and activate an Update Set for capturing changes",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Update set name e.g. DAP-2024-Harsh" },
        description: { type: "string" },
        set_as_current: { type: "boolean", description: "Make this the active update set" },
      },
      required: ["name"],
    },
  },

  // ── AUTO-NUMBER ──────────────────────────────────────────────────────────────
  {
    name: "configure_auto_number",
    description: "Set up auto-numbering for a table with custom prefix format",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        prefix: { type: "string", description: "Number prefix e.g. FRC, MNT, INC" },
        minimum_digits: { type: "number", description: "Zero-padded digits e.g. 5 gives 00001" },
        maximum_number: { type: "number" },
      },
      required: ["table", "prefix"],
    },
  },

  // ── BATCH OPERATIONS ─────────────────────────────────────────────────────────
  {
    name: "execute_background_script",
    description: "Run any server-side JavaScript directly on the instance (background scripts)",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "Full server-side JavaScript to execute" },
      },
      required: ["script"],
    },
  },
  {
    name: "batch_create",
    description: "Create multiple records in one call — useful for seeding test data or creating multiple related records",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        records: {
          type: "array",
          description: "Array of field objects to create",
          items: { type: "object" },
        },
      },
      required: ["table", "records"],
    },
  },

  // ── GLIDE AJAX HELPER ────────────────────────────────────────────────────────
  {
    name: "create_glide_ajax_script_include",
    description: "Create a client-callable Script Include (for GlideAjax from client scripts/UI Actions)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        methods: {
          type: "array",
          description: "Array of {method_name, script} to add to the class",
          items: {
            type: "object",
            properties: {
              method_name: { type: "string" },
              script: { type: "string", description: "Method body (inside the function)" },
            },
          },
        },
        description: { type: "string" },
      },
      required: ["name", "methods"],
    },
  },

  // ── CATALOG ITEMS ────────────────────────────────────────────────────────────
  {
    name: "create_catalog_item",
    description: "Create a Service Catalog item",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        short_description: { type: "string" },
        category: { type: "string", description: "Category name" },
        price: { type: "string", description: "Price e.g. 0 or 100" },
        delivery_plan: { type: "string" },
        script: { type: "string", description: "Script for catalog processing" },
        active: { type: "boolean" },
      },
      required: ["name", "short_description"],
    },
  },

  // ── LOOKUP / SEARCH ──────────────────────────────────────────────────────────
  {
    name: "find_record",
    description: "Find a single record by a field value and return its sys_id",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        field: { type: "string", description: "Field to search on e.g. name, number" },
        value: { type: "string" },
      },
      required: ["table", "field", "value"],
    },
  },
];

// ─── TOOL HANDLERS ────────────────────────────────────────────────────────────
async function runTool(name, args) {
  switch (name) {

    // CRUD
    case "create_record": {
      const r = await snRequest("POST", `/api/now/table/${args.table}`, args.fields);
      const res = ok(r);
      return `✅ Created ${args.table} | sys_id: ${res.sys_id} | number: ${res.number || "N/A"}`;
    }
    case "get_records": {
      const qs = new URLSearchParams({ sysparm_limit: args.limit || 10 });
      if (args.query) qs.set("sysparm_query", args.query);
      if (args.fields) qs.set("sysparm_fields", args.fields);
      const r = await snRequest("GET", `/api/now/table/${args.table}?${qs}`);
      const results = r.body?.result || [];
      return results.length ? JSON.stringify(results, null, 2) : "No records found";
    }
    case "update_record": {
      const r = await snRequest("PATCH", `/api/now/table/${args.table}/${args.sys_id}`, args.fields);
      ok(r);
      return `✅ Updated ${args.table}/${args.sys_id}`;
    }
    case "delete_record": {
      const r = await snRequest("DELETE", `/api/now/table/${args.table}/${args.sys_id}`);
      if (r.status === 204) return `✅ Deleted ${args.table}/${args.sys_id}`;
      throw new Error(`Delete failed: ${r.status}`);
    }

    // TABLE & SCHEMA
    case "create_custom_table": {
      const payload = {
        label: args.label,
        name: args.name,
        super_class: { name: args.extends_table || "task" },
        is_extendable: "true",
        ws_access: "true",
      };
      const r = await snRequest("POST", "/api/now/table/sys_db_object", payload);
      const res = ok(r);
      let msg = `✅ Table created: u_${args.name} (sys_id: ${res.sys_id})`;
      if (args.auto_number && args.number_prefix) {
        const nr = await snRequest("POST", "/api/now/table/sys_number", {
          table: `u_${args.name}`,
          prefix: args.number_prefix,
          minimum_digits: 5,
        });
        msg += ` | Auto-number: ${args.number_prefix}-XXXXXX`;
      }
      return msg;
    }
    case "add_field_to_table": {
      const typeMap = {
        string: "string", integer: "integer", boolean: "boolean",
        decimal: "decimal2", date: "glide_date", datetime: "glide_date_time",
        reference: "reference", choice: "string", html: "html", url: "url",
        email: "email", phone_number: "phone_number", currency: "currency",
        glide_duration: "glide_duration", list: "glide_list",
      };
      const payload = {
        element: `u_${args.name}`,
        column_label: args.label,
        internal_type: typeMap[args.type] || args.type,
        name: args.table,
        max_length: args.max_length || (args.type === "string" ? 255 : undefined),
        mandatory: args.mandatory ? "true" : "false",
        default_value: args.default_value || "",
        reference: args.reference_table || "",
      };
      const r = await snRequest("POST", "/api/now/table/sys_dictionary", payload);
      const res = ok(r);
      let msg = `✅ Field u_${args.name} (${args.type}) added to ${args.table}`;

      // Add choices if provided
      if (args.choices && args.choices.length > 0) {
        for (const c of args.choices) {
          await snRequest("POST", "/api/now/table/sys_choice", {
            name: args.table,
            element: `u_${args.name}`,
            label: c.label,
            value: c.value,
            sequence: args.choices.indexOf(c) * 10,
          });
        }
        msg += ` | ${args.choices.length} choices added`;
      }
      return msg;
    }
    case "get_table_schema": {
      const qs = new URLSearchParams({
        sysparm_query: `name=${args.table}`,
        sysparm_fields: "element,column_label,internal_type,mandatory,default_value",
        sysparm_limit: 200,
      });
      const r = await snRequest("GET", `/api/now/table/sys_dictionary?${qs}`);
      return JSON.stringify(r.body?.result || [], null, 2);
    }

    // BUSINESS RULE
    case "create_business_rule": {
      const payload = {
        name: args.name,
        collection: args.table,
        when: args.when,
        action_insert: args.insert ? "true" : "false",
        action_update: args.update ? "true" : "false",
        action_delete: args.delete ? "true" : "false",
        action_query: args.query ? "true" : "false",
        script: args.script,
        condition: args.condition || "",
        filter_condition: args.filter_condition || "",
        order: args.order || 100,
        active: args.active !== false ? "true" : "false",
      };
      const r = await snRequest("POST", "/api/now/table/sys_script", payload);
      const res = ok(r);
      return `✅ Business Rule "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // CLIENT SCRIPT
    case "create_client_script": {
      const payload = {
        name: args.name,
        table: args.table,
        type: args.type,
        script: args.script,
        field_name: args.field_name || "",
        ui_type: args.ui_type || "0", // 0 = all
        active: args.active !== false ? "true" : "false",
      };
      const r = await snRequest("POST", "/api/now/table/sys_script_client", payload);
      const res = ok(r);
      return `✅ Client Script "${args.name}" (${args.type}) created | sys_id: ${res.sys_id}`;
    }

    // UI ACTION
    case "create_ui_action": {
      const payload = {
        name: args.name,
        table: args.table,
        action_name: args.action_name,
        script: args.script,
        client: args.client ? "true" : "false",
        form_button: args.form_button ? "true" : "false",
        form_context_menu: args.form_context_menu ? "true" : "false",
        list_banner_button: args.list_banner_button ? "true" : "false",
        list_context_menu: args.list_context_menu ? "true" : "false",
        show_insert: args.show_insert ? "true" : "false",
        show_update: args.show_update !== false ? "true" : "false",
        condition: args.condition || "",
        hint: args.hint || "",
        active: args.active !== false ? "true" : "false",
        order: args.order || 100,
      };
      const r = await snRequest("POST", "/api/now/table/sys_ui_action", payload);
      const res = ok(r);
      return `✅ UI Action "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // UI PAGE
    case "create_ui_page": {
      const payload = {
        name: args.name,
        html: args.html,
        client_script: args.client_script || "",
        processing_script: args.processing_script || "",
        direct: args.direct ? "true" : "false",
        category: args.category || "general",
      };
      const r = await snRequest("POST", "/api/now/table/sys_ui_page", payload);
      const res = ok(r);
      return `✅ UI Page "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // SCRIPT INCLUDE
    case "create_script_include": {
      const payload = {
        name: args.name,
        script: args.script,
        api_name: args.name,
        client_callable: args.client_callable ? "true" : "false",
        description: args.description || "",
        active: args.active !== false ? "true" : "false",
      };
      const r = await snRequest("POST", "/api/now/table/sys_script_include", payload);
      const res = ok(r);
      return `✅ Script Include "${args.name}" created | client_callable: ${args.client_callable || false} | sys_id: ${res.sys_id}`;
    }

    // NOTIFICATION
    case "create_notification": {
      const payload = {
        name: args.name,
        collection: args.table,
        subject: args.subject,
        message_html: args.body,
        send_when: args.when,
        condition: args.condition || "",
        active: args.active !== false ? "true" : "false",
      };
      const r = await snRequest("POST", "/api/now/table/sysevent_email_action", payload);
      const res = ok(r);
      return `✅ Notification "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // SCHEDULED JOB
    case "create_scheduled_job": {
      const runTypeMap = {
        daily: "daily", weekly: "weekly", monthly: "monthly",
        periodically: "periodically", once: "once", on_demand: "on_demand",
      };
      const payload = {
        name: args.name,
        script: args.script,
        run_type: runTypeMap[args.run_type] || "daily",
        run_time: args.run_time || "07:00:00",
        run_day_of_week: args.run_day_of_week || "1",
        run_period: args.run_period || "",
        active: args.active !== false ? "true" : "false",
      };
      const r = await snRequest("POST", "/api/now/table/sysauto_script", payload);
      const res = ok(r);
      return `✅ Scheduled Job "${args.name}" (${args.run_type}) created | sys_id: ${res.sys_id}`;
    }

    // ACL
    case "create_acl": {
      const payload = {
        name: `${args.table}${args.field ? "." + args.field : ""}`,
        object: args.table,
        object_fields: args.field || "",
        operation: args.operation,
        condition: args.condition || "",
        script: args.script || "",
        active: args.active !== false ? "true" : "false",
      };
      // Add roles
      const r = await snRequest("POST", "/api/now/table/sys_security_acl", payload);
      const res = ok(r);
      let msg = `✅ ACL "${args.name}" (${args.operation}) created | sys_id: ${res.sys_id}`;
      if (args.roles) {
        for (const roleName of args.roles.split(",").map(s => s.trim())) {
          // Find role sys_id
          const roleR = await snRequest("GET", `/api/now/table/sys_user_role?sysparm_query=name=${roleName}&sysparm_fields=sys_id&sysparm_limit=1`);
          const roleRes = roleR.body?.result?.[0];
          if (roleRes) {
            await snRequest("POST", "/api/now/table/sys_security_acl_role", {
              acl: res.sys_id,
              role: roleRes.sys_id,
            });
          }
        }
        msg += ` | Roles: ${args.roles}`;
      }
      return msg;
    }

    // ROLE
    case "create_role": {
      const r = await snRequest("POST", "/api/now/table/sys_user_role", {
        name: args.name,
        description: args.description || "",
        assignable_by: args.assignable_by || "",
      });
      const res = ok(r);
      return `✅ Role "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // GROUP
    case "create_group": {
      const r = await snRequest("POST", "/api/now/table/sys_user_group", {
        name: args.name,
        description: args.description || "",
        manager: args.manager || "",
      });
      const res = ok(r);
      let msg = `✅ Group "${args.name}" created | sys_id: ${res.sys_id}`;
      if (args.roles && args.roles.length > 0) {
        for (const roleName of args.roles) {
          const roleR = await snRequest("GET", `/api/now/table/sys_user_role?sysparm_query=name=${roleName}&sysparm_fields=sys_id&sysparm_limit=1`);
          const roleRes = roleR.body?.result?.[0];
          if (roleRes) {
            await snRequest("POST", "/api/now/table/sys_group_has_role", {
              group: res.sys_id,
              role: roleRes.sys_id,
            });
          }
        }
        msg += ` | Roles assigned: ${args.roles.join(", ")}`;
      }
      return msg;
    }

    // ADD USER TO GROUP
    case "add_user_to_group": {
      const grpR = await snRequest("GET", `/api/now/table/sys_user_group?sysparm_query=name=${encodeURIComponent(args.group_name)}&sysparm_fields=sys_id&sysparm_limit=1`);
      const grp = grpR.body?.result?.[0];
      if (!grp) return `❌ Group "${args.group_name}" not found`;
      const r = await snRequest("POST", "/api/now/table/sys_user_grmember", {
        user: args.user_sys_id,
        group: grp.sys_id,
      });
      ok(r);
      return `✅ User added to group "${args.group_name}"`;
    }

    // SYSTEM PROPERTY
    case "create_system_property": {
      const r = await snRequest("POST", "/api/now/table/sys_properties", {
        name: args.name,
        value: args.value,
        description: args.description || "",
        type: args.type || "string",
        suffix: args.suffix || "",
      });
      const res = ok(r);
      return `✅ Property "${args.name}" = "${args.value}" created | sys_id: ${res.sys_id}`;
    }

    // PORTAL
    case "create_portal": {
      const r = await snRequest("POST", "/api/now/table/sp_portal", {
        title: args.title,
        url_suffix: args.url_suffix,
        description: args.description || "",
        css_variables: args.css_variables || "",
      });
      const res = ok(r);
      return `✅ Portal "${args.title}" created at /${args.url_suffix} | sys_id: ${res.sys_id}`;
    }

    // PORTAL PAGE
    case "create_portal_page": {
      const r = await snRequest("POST", "/api/now/table/sp_page", {
        title: args.title,
        id: args.id,
        sp_portal: args.portal_sys_id,
        description: args.description || "",
      });
      const res = ok(r);
      return `✅ Portal Page "${args.title}" (id: ${args.id}) created | sys_id: ${res.sys_id}`;
    }

    // WIDGET
    case "create_widget": {
      const r = await snRequest("POST", "/api/now/table/sp_widget", {
        name: args.name,
        id: args.id,
        template: args.template,
        css: args.css || "",
        script: args.server_script || "",
        client_script: args.client_script || "",
        option_schema: args.option_schema || "",
        has_preview: args.has_preview ? "true" : "false",
      });
      const res = ok(r);
      return `✅ Widget "${args.name}" (id: ${args.id}) created | sys_id: ${res.sys_id}`;
    }

    // ADD WIDGET TO PAGE
    case "add_widget_to_page": {
      // First create a container, then row, then column with widget
      const contR = await snRequest("POST", "/api/now/table/sp_container", {
        sp_page: args.page_sys_id,
        order: args.order || 10,
        background_color: "",
      });
      const cont = ok(contR);
      const rowR = await snRequest("POST", "/api/now/table/sp_row", {
        sp_container: cont.sys_id,
        order: 10,
      });
      const row = ok(rowR);
      const colR = await snRequest("POST", "/api/now/table/sp_column", {
        sp_row: row.sys_id,
        size_md: "12",
        order: 10,
      });
      const col = ok(colR);
      const instR = await snRequest("POST", "/api/now/table/sp_instance", {
        sp_widget: args.widget_sys_id,
        sp_column: col.sys_id,
        order: 10,
      });
      ok(instR);
      return `✅ Widget added to page (container → row → column → instance created)`;
    }

    // FLOW
    case "create_flow": {
      const r = await snRequest("POST", "/api/now/table/sys_hub_flow", {
        name: args.name,
        description: args.description || "",
        active: args.active !== false ? "true" : "false",
        run_as: "user",
        access: "public",
      });
      const res = ok(r);
      return `✅ Flow "${args.name}" created | sys_id: ${res.sys_id} | Note: Add trigger/actions via Flow Designer UI or REST`;
    }

    // TRANSFORM MAP
    case "create_transform_map": {
      const r = await snRequest("POST", "/api/now/table/sys_transform_map", {
        name: args.name,
        source_table: args.source_table,
        target_table: args.target_table,
        coalesce: args.coalesce_fields ? "true" : "false",
        run_business_rules: args.run_business_rules ? "true" : "false",
        run_script: "true",
        script_before: args.on_before_script || "",
        script_after: args.on_after_script || "",
      });
      const res = ok(r);
      return `✅ Transform Map "${args.name}" created | ${args.source_table} → ${args.target_table} | sys_id: ${res.sys_id}`;
    }

    // RECORD PRODUCER
    case "create_record_producer": {
      const r = await snRequest("POST", "/api/now/table/sc_cat_item_producer", {
        name: args.name,
        table_name: args.table,
        short_description: args.short_description,
        script: args.script || "",
        active: "true",
      });
      const res = ok(r);
      return `✅ Record Producer "${args.name}" created for table ${args.table} | sys_id: ${res.sys_id}`;
    }

    // UPDATE SET
    case "create_update_set": {
      const r = await snRequest("POST", "/api/now/table/sys_update_set", {
        name: args.name,
        description: args.description || "",
        state: "in progress",
      });
      const res = ok(r);
      return `✅ Update Set "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // AUTO NUMBER
    case "configure_auto_number": {
      const existing = await snRequest("GET", `/api/now/table/sys_number?sysparm_query=table=${args.table}&sysparm_limit=1`);
      const existingRes = existing.body?.result?.[0];
      if (existingRes) {
        const r = await snRequest("PATCH", `/api/now/table/sys_number/${existingRes.sys_id}`, {
          prefix: args.prefix,
          minimum_digits: args.minimum_digits || 5,
        });
        ok(r);
        return `✅ Auto-number updated for ${args.table}: ${args.prefix}-XXXXX`;
      }
      const r = await snRequest("POST", "/api/now/table/sys_number", {
        table: args.table,
        prefix: args.prefix,
        minimum_digits: args.minimum_digits || 5,
        maximum_number: args.maximum_number || 9999999,
      });
      const res = ok(r);
      return `✅ Auto-number configured for ${args.table}: ${args.prefix}-XXXXX | sys_id: ${res.sys_id}`;
    }

    // BACKGROUND SCRIPT
    case "execute_background_script": {
      // Use the table API to create a background script execution record
      const r = await snRequest("POST", "/api/now/table/sys_ui_script", {
        name: "_mcp_bg_exec_" + Date.now(),
        script: args.script,
        global: "true",
        active: "false",
      });
      // Note: background script execution requires a different approach
      return `⚠️ Script stored. To execute background scripts, use Scripts-Background in SN UI or implement via REST API scripting endpoint. Script:\n${args.script.substring(0, 200)}...`;
    }

    // BATCH CREATE
    case "batch_create": {
      const results = [];
      for (const rec of args.records) {
        const r = await snRequest("POST", `/api/now/table/${args.table}`, rec);
        try {
          const res = ok(r);
          results.push(`✅ ${res.sys_id}`);
        } catch (e) {
          results.push(`❌ ${e.message}`);
        }
      }
      return `Batch created ${args.records.length} records in ${args.table}:\n${results.join("\n")}`;
    }

    // GLIDE AJAX SCRIPT INCLUDE
    case "create_glide_ajax_script_include": {
      const methodBodies = args.methods.map(m =>
        `    ${m.method_name}: function() {\n        ${m.script}\n    }`
      ).join(",\n\n");
      const script = `var ${args.name} = Class.create();
${args.name}.prototype = Object.extendsObject(AbstractAjaxProcessor, {

${methodBodies},

    type: '${args.name}'
});`;
      const r = await snRequest("POST", "/api/now/table/sys_script_include", {
        name: args.name,
        script,
        api_name: args.name,
        client_callable: "true",
        description: args.description || `GlideAjax Script Include: ${args.name}`,
        active: "true",
      });
      const res = ok(r);
      return `✅ GlideAjax Script Include "${args.name}" created with methods: ${args.methods.map(m => m.method_name).join(", ")} | sys_id: ${res.sys_id}`;
    }

    // CATALOG ITEM
    case "create_catalog_item": {
      const r = await snRequest("POST", "/api/now/table/sc_cat_item", {
        name: args.name,
        short_description: args.short_description,
        price: args.price || "0",
        active: args.active !== false ? "true" : "false",
      });
      const res = ok(r);
      return `✅ Catalog Item "${args.name}" created | sys_id: ${res.sys_id}`;
    }

    // FIND RECORD
    case "find_record": {
      const qs = new URLSearchParams({
        sysparm_query: `${args.field}=${args.value}`,
        sysparm_fields: "sys_id,name,number",
        sysparm_limit: 1,
      });
      const r = await snRequest("GET", `/api/now/table/${args.table}?${qs}`);
      const res = r.body?.result?.[0];
      return res ? JSON.stringify(res) : `No record found in ${args.table} where ${args.field}=${args.value}`;
    }

    default:
      return `❌ Unknown tool: ${name}`;
  }
}

// ─── MCP STDIO TRANSPORT ──────────────────────────────────────────────────────
process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (line.trim()) handleMessage(line.trim());
  }
});

async function handleMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  const { id, method, params } = msg;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0", id, result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "servicenow-ultra-mcp", version: "2.0.0" }
      }
    });
  } else if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  } else if (method === "tools/call") {
    try {
      const output = await runTool(params.name, params.arguments);
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: output }] } });
    } catch (e) {
      send({
        jsonrpc: "2.0", id, result: {
          content: [{ type: "text", text: `❌ Error: ${e.message}` }],
          isError: true,
        }
      });
    }
  } else if (method === "notifications/initialized") {
    // no-op
  } else {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
  }
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}