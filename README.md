# Vesta Power BI Dashboard

This repository contains the Power BI Desktop report for the Vesta dashboard.

## Contents

- `vesta.pbix` — the Power BI Desktop report file.

## Publishing and scheduled refresh

Keeping this file in Git does not configure or trigger data refreshes. To enable scheduled refresh after publishing the report:

1. Publish `vesta.pbix` to the intended Power BI workspace.
2. In Power BI Service, open the semantic model settings.
3. Configure credentials for every data source.
4. Install and configure an on-premises data gateway if any source is inside a private network.
5. Turn on **Scheduled refresh** and set the desired cadence.

## Versioning note

PBIX is a binary file, so Git can store its versions but cannot show useful line-by-line changes. For richer reviews and merges in future, consider saving the report as a Power BI Project (`.pbip`) and committing the project files alongside or instead of the PBIX export.

## Recommended first commit

```text
Initial Power BI dashboard
```
