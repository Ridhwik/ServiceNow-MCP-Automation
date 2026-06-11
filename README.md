# 🚀 ServiceNow MCP Server for Automation

A powerful **Model Context Protocol (MCP) server** that exposes your ServiceNow instance as a full-featured AI tool. Connect any MCP-compatible AI client (Claude Desktop, Cursor, etc.) and let it read, create, and manage ServiceNow artifacts directly — no manual UI clicks required.

---

## ✨ Features

This server covers virtually the entire ServiceNow development surface area:

| Category | Tools |
|---|---|
| **Records (CRUD)** | Create, Read, Update, Delete any table record |
| **Tables & Schema** | Create custom tables, add fields, get schema |
| **Business Rules** | Create server-side rules (before/after/async/display) |
| **Client Scripts** | onLoad, onChange, onSubmit, onCellEdit |
| **UI Actions** | Form buttons, list buttons, context menu items |
| **UI Pages** | Jelly/HTML pages for modals and custom views |
| **Script Includes** | Reusable server-side classes + GlideAjax helpers |
| **Notifications** | Email notifications with dynamic field variables |
| **Scheduled Jobs** | Cron-style scheduled script executions |
| **ACLs** | Table-level and field-level access control rules |
| **Roles & Groups** | Create roles, groups, add users to groups |
| **System Properties** | Application configuration values |
| **Service Portal** | Portals, pages, widgets, widget-to-page placement |
| **Flow Designer** | Create flows (record/schedule/app/email triggers) |
| **Transform Maps** | Data import transform maps with before/after scripts |
| **Record Producers** | Catalog items that create records |
| **Update Sets** | Create and activate update sets |
| **Auto-Numbering** | Configure prefix-based auto-number sequences |
| **Catalog Items** | Service Catalog item creation |
| **Batch Operations** | Bulk record creation, background script execution |
| **Utilities** | Find records by field value |

---

## 📋 Prerequisites

- **Node.js** v16 or higher
- A ServiceNow instance (Developer, PDI, or production)
- An MCP-compatible client (e.g., [Claude Desktop](https://claude.ai/download))
- ServiceNow credentials with sufficient admin/developer privileges

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/servicenow-ultra-mcp.git
cd servicenow-ultra-mcp
```

### 2. Install dependencies

```bash
npm install
```

> This project uses only Node.js built-in modules (`https`, `http`) — no additional npm packages are required.

### 3. Set environment variables

Create a `.env` file or export variables in your shell:

```bash
export SN_INSTANCE="https://your-instance.service-now.com"
export SN_USERNAME="your_username"
export SN_PASSWORD="your_password"
```
## 🔌 Connecting to Claude Desktop

Add the server to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "servicenow": {
      "command": "node",
      "args": ["/absolute/path/to/servicenow-ultra-mcp/index.js"],
      "env": {
        "SN_INSTANCE": "https://your-instance.service-now.com",
        "SN_USERNAME": "your_username",
        "SN_PASSWORD": "your_password"
      }
    }
  }
}
```

Restart Claude Desktop after saving the config.

---

## 🛠️ Available Tools (Quick Reference)

### Records
| Tool | Description |
|---|---|
| `create_record` | Create any record in any table |
| `get_records` | Query records with encoded query filters |
| `update_record` | Update a record by sys_id |
| `delete_record` | Delete a record by sys_id |
| `find_record` | Find a record by field/value pair |
| `batch_create` | Create multiple records in one call |

### Schema & Tables
| Tool | Description |
|---|---|
| `create_custom_table` | Create a new application table |
| `add_field_to_table` | Add a column to any table |
| `get_table_schema` | List all fields on a table |

### Scripting
| Tool | Description |
|---|---|
| `create_business_rule` | Server-side business rule |
| `create_client_script` | Client-side script (onLoad/onChange/etc.) |
| `create_script_include` | Reusable server-side class |
| `create_glide_ajax_script_include` | Client-callable GlideAjax class |
| `create_ui_action` | Button or context menu action |
| `create_ui_page` | Jelly HTML page |
| `execute_background_script` | Run ad-hoc server-side JS |

### Portal
| Tool | Description |
|---|---|
| `create_portal` | Create a Service Portal |
| `create_portal_page` | Add a page to a portal |
| `create_widget` | Create a portal widget (HTML/CSS/JS) |
| `add_widget_to_page` | Place a widget on a page |

### Security & Admin
| Tool | Description |
|---|---|
| `create_acl` | Access control rule |
| `create_role` | Custom application role |
| `create_group` | User group with optional roles |
| `add_user_to_group` | Add user to an existing group |
| `create_system_property` | System/app property |

### Automation
| Tool | Description |
|---|---|
| `create_notification` | Email notification |
| `create_scheduled_job` | Scheduled script execution |
| `create_flow` | Flow Designer flow |
| `create_transform_map` | Data import transform |
| `create_record_producer` | Catalog-based record creator |
| `create_catalog_item` | Service Catalog item |

### DevOps
| Tool | Description |
|---|---|
| `create_update_set` | Create/activate an update set |
| `configure_auto_number` | Set up auto-numbering for a table |

---

## 💬 Example Prompts

Once connected to Claude Desktop, you can use natural language:

```
"Create a business rule on the incident table that fires before insert and sets priority to 1 if category is network"

"Add a reference field called 'Assigned Vendor' to the u_maintenance_request table pointing to core_company"

"Create a Service Portal widget that shows the top 5 open incidents for the logged-in user"

"Create an update set called Sprint-14-Changes and make it the active update set"

"Get all records from the cmdb_ci_server table where install_status=1, limit 20"
```

---

## 🔒 Security Notes

- Credentials are passed via environment variables and encoded as HTTP Basic Auth
- This server has **write access** to your ServiceNow instance — use a dedicated service account with scoped permissions in production
- Avoid running against production instances without proper change management
- The `execute_background_script` tool stores scripts but cannot directly trigger execution — use the ServiceNow Scripts-Background UI for that

---

## 🏗️ Architecture

```
MCP Client (Claude Desktop)
        │  JSON-RPC over stdio
        ▼
  index.js (MCP Server)
        │  HTTPS Basic Auth
        ▼
ServiceNow REST API (/api/now/table/*)
        │
        ▼
  Your SN Instance
```

The server implements the MCP protocol (`2024-11-05`) over stdio transport, accepting `initialize`, `tools/list`, and `tools/call` methods.

---

## 📝 License

MIT License — feel free to use, modify, and distribute.

---

## 🤝 Contributing

Pull requests are welcome! If you've added support for a new ServiceNow module or improved an existing tool, open a PR.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/add-cmdb-tools`)
3. Commit your changes
4. Push and open a Pull Request
