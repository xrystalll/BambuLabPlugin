
# Bambu monitor

![Plugin screenshot](/Flexbar-screenshot.jpg)

## How to use

Add file com.xrystalll.bambu.flexplugin on FlexDesigner using the plus button on the right sidebar and fill the configuration fields.

Works with the "LAN only" setting disabled. You can continue using Bambu Cloud.
This plugin is just an information display and does not control the printer.

Tested with P2S printer.

## Installation


### **Prerequisites**

- Node.js 18 or later  
- FlexDesigner v1.0.0 or later  
- A Flexbar device 
- Install FlexCLI  
  ```
  npm install -g @eniac/flexcli
  ```

### Clone & Setup

```
git clone https://github.com/xrystalll/BambuLabPlugin.git
cd BambuLabPlugin
npm install
```

## Debug

```
npm run dev
```

## Build & Pack

```
npm run build
npm run plugin:pack --path com.xrystalll.bambu.plugin
```
  
