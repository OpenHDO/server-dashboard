export function activate(host) {
  const { createElement: h, useEffect, useState } = host.React;
  const button = { padding: "8px 12px", border: "1px solid #525252", borderRadius: 6 };
  function Dashboard({ context }) {
    const [devices, setDevices] = useState([]);
    const [layout, setLayout] = useState({ devices: [], widgets: [] });
    const [editing, setEditing] = useState(false);
    useEffect(() => {
      let disposed = false;
      const load = async () => {
        const response = await context.api.request("/api/v1/devices");
        if (!response.ok) throw new Error("Unable to load devices");
        if (!disposed) setDevices((await response.json()).devices);
      };
      void host.request("layout").then(async (response) => { if (!response.ok) throw new Error("Unable to load dashboard"); if (!disposed) setLayout(await response.json()); }).catch((error) => host.notify("error", error.message));
      void load().catch((error) => host.notify("error", error.message));
      const interval = setInterval(() => { void load().catch((error) => host.notify("error", error.message)); }, 10000);
      return () => { disposed = true; clearInterval(interval); };
    }, []);
    const save = async () => {
      const response = await host.request("layout", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(layout) });
      if (response.ok) { setEditing(false); host.notify("success", "Dashboard saved"); }
      else host.notify("error", "Unable to save dashboard");
    };
    return h("section", {style:{maxWidth:1100, margin:"auto"}},
      h("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}, h("h1", {style:{fontSize:24,fontWeight:700}}, "Dashboards"),
        context.auth.user?.role === "admin" && h("button", {style:button,onClick:() => editing ? void save() : setEditing(true)}, editing ? "Save" : "Edit")),
      editing && h("div", {style:{display:"flex",flexWrap:"wrap",gap:12,marginBottom:12}}, devices.map((device) => h("label", {key:device.id}, h("input", {type:"checkbox", checked:layout.devices.includes(device.id), onChange:(event) => setLayout({...layout,devices:event.target.checked ? [...layout.devices,device.id] : layout.devices.filter((id) => id !== device.id)})}), " ", device.name))),
      h("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}, devices.filter((device) => layout.devices.includes(device.id)).map((device) => {
        const Renderer = host.extensions("deviceModels").find((model) => model.kind === device.kind)?.component ?? host.ui.DeviceCard;
        return h(Renderer, {key:device.id,device,context,pending:false,edit:()=>context.navigate("devices"),send:async (control,value) => {
          const response = await context.api.request(`/api/v1/devices/${device.id}/actions`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:control.code,value})});
          if (!response.ok) { host.notify("error", "Device command failed"); return false; }
          const updated = await response.json(); setDevices((current) => current.map((item) => item.id === updated.id ? updated : item)); return true;
        }});
      }), (layout.widgets ?? []).map((widget, index) => {
        const Component = host.extensions("widgets").find((item) => item.id === widget.type)?.component;
        return Component ? h(Component, {key:`widget:${index}`,config:widget.config,devices,context}) : null;
      })));
  }
  host.module({id:"dashboards",label:"Dashboards",order:10,component:Dashboard});
}
