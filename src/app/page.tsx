"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import rawCatalog from "@/data/catalog.json";
import { supabase } from "@/lib/supabase";
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  ShieldAlert, 
  Truck, 
  MapPin, 
  Trash2, 
  CheckCircle2, 
  Layers,
  Leaf,
  Send,
  ClipboardList,
  Store,
  Phone,
  User,
  Clock,
  RefreshCw,
  X,
  ChevronUp,
  Printer,
  Calendar,
  BarChart3
} from "lucide-react";
import Link from "next/link";

interface Producto {
  id: number;
  nombre: string;
  presentacion: string;
  precio: number;
  categoria: string;
}

interface ItemCarrito extends Producto {
  cantidad: number;
}

interface PedidoGuardado {
  id: number;
  created_at: string;
  nombre_cliente: string;
  nombre_vivero: string;
  ciudad_departamento: string;
  telefono: string;
  direccion: string;
  items: ItemCarrito[];
  subtotal: number;
  valor_flete: number;
  total: number;
  estado: string;
}

const DEPARTAMENTOS_COLOMBIA = [
  "Cundinamarca (Sede Principal)",
  "Bogotá D.C.",
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada"
];

export default function Home() {
  const [vista, setVista] = useState<"catalogo" | "admin">("catalogo");
  
  // Filtros del Catálogo
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("Todas");
  const [presentacionSel, setPresentacionSel] = useState("Todas");
  
  // Estado del Carrito
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cantidadesTarjeta, setCantidadesTarjeta] = useState<{ [id: number]: number }>({});
  const [incluirFlete, setIncluirFlete] = useState(true);
  const [carritoMovilAbierto, setCarritoMovilAbierto] = useState(false);

  // Formulario de Pedido Rápido
  const [mostrarModalForm, setMostrarModalForm] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [nombreVivero, setNombreVivero] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [deptoDestino, setDeptoDestino] = useState("Cundinamarca (Sede Principal)");
  const [direccionEnvio, setDireccionEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exitoGuardado, setExitoGuardado] = useState(false);

  // Pedidos Recibidos (Supabase)
  const [pedidosSupabase, setPedidosSupabase] = useState<PedidoGuardado[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);

  // FILTROS AVANZADOS DE PANEL ADMIN (Fechas y Departamentos)
  const [filtroFechaRango, setFiltroFechaRango] = useState<"todos" | "hoy" | "semana" | "mes">("todos");
  const [filtroDeptoAdmin, setFiltroDeptoAdmin] = useState("Todos");
  const [busquedaClienteAdmin, setBusquedaClienteAdmin] = useState("");

  // Pedido Seleccionado para Ver Factura / Imprimir
  const [pedidoParaImprimir, setPedidoParaImprimir] = useState<PedidoGuardado | null>(null);

  // Estado para prevenir el error de prerenderizado estático en Next.js con new Date()
  // Fecha de referencia para los filtros del panel admin (se calcula una sola vez al montar)
const [fechaActualCliente] = useState<Date>(() => new Date());

  // Listas de categorías y presentaciones
  const presentaciones = useMemo(() => ["Todas", ...Array.from(new Set(rawCatalog.map((p) => p.presentacion)))], []);
  const categorias = useMemo(() => ["Todas", ...Array.from(new Set(rawCatalog.map((p) => p.categoria)))], []);

  // Filtrado de productos en catálogo
  const productosFiltrados = useMemo(() => {
    return rawCatalog.filter((item) => {
      const matchNombre = item.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const matchCat = categoriaSel === "Todas" || item.categoria === categoriaSel;
      const matchPres = presentacionSel === "Todas" || item.presentacion === presentacionSel;
      return matchNombre && matchCat && matchPres;
    });
  }, [busqueda, categoriaSel, presentacionSel]);

  // FILTRADO LÓGICO DE PEDIDOS EN EL PANEL ADMIN POR FECHAS Y DEPARTAMENTOS
  const pedidosFiltradosAdmin = useMemo(() => {
    if (!fechaActualCliente) return pedidosSupabase;

    const inicioHoy = new Date(fechaActualCliente.getFullYear(), fechaActualCliente.getMonth(), fechaActualCliente.getDate());
    
    // Inicio de semana (Lunes)
    const diaSemana = fechaActualCliente.getDay() || 7;
    const inicioSemana = new Date(fechaActualCliente);
    inicioSemana.setDate(fechaActualCliente.getDate() - diaSemana + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    // Inicio de mes
    const inicioMes = new Date(fechaActualCliente.getFullYear(), fechaActualCliente.getMonth(), 1);

    return pedidosSupabase.filter((ped) => {
      const fechaPed = new Date(ped.created_at);

      // 1. Filtro por Rango de Fecha
      let cumpleFecha = true;
      if (filtroFechaRango === "hoy") {
        cumpleFecha = fechaPed >= inicioHoy;
      } else if (filtroFechaRango === "semana") {
        cumpleFecha = fechaPed >= inicioSemana;
      } else if (filtroFechaRango === "mes") {
        cumpleFecha = fechaPed >= inicioMes;
      }

      // 2. Filtro por Departamento / Ruta
      const cumpleDepto = filtroDeptoAdmin === "Todos" || ped.ciudad_departamento === filtroDeptoAdmin;

      // 3. Filtro por Nombre de Cliente o Vivero
      const cumpleBusqueda = 
        !busquedaClienteAdmin || 
        ped.nombre_cliente.toLowerCase().includes(busquedaClienteAdmin.toLowerCase()) ||
        (ped.nombre_vivero && ped.nombre_vivero.toLowerCase().includes(busquedaClienteAdmin.toLowerCase()));

      return cumpleFecha && cumpleDepto && cumpleBusqueda;
    });
  }, [pedidosSupabase, filtroFechaRango, filtroDeptoAdmin, busquedaClienteAdmin, fechaActualCliente]);

  // Manejo de Cantidades
  const manejarCambioCantTarjeta = (id: number, valor: string) => {
    const num = parseInt(valor, 10);
    setCantidadesTarjeta((prev) => ({
      ...prev,
      [id]: isNaN(num) || num < 1 ? 1 : num
    }));
  };

  const agregarAlCarrito = (producto: Producto) => {
    const cantidadASumar = cantidadesTarjeta[producto.id] || 1;
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe) {
        return prev.map((i) => i.id === producto.id ? { ...i, cantidad: i.cantidad + cantidadASumar } : i);
      }
      return [...prev, { ...producto, cantidad: cantidadASumar }];
    });
    setCantidadesTarjeta((prev) => ({ ...prev, [producto.id]: 1 }));
  };

  const manejarCambioCantCarrito = (id: number, valor: string) => {
    const num = parseInt(valor, 10);
    const cantValida = isNaN(num) || num < 1 ? 1 : num;
    setCarrito((prev) =>
      prev.map((i) => (i.id === id ? { ...i, cantidad: cantValida } : i))
    );
  };

  const cambiarCantidadBoton = (id: number, delta: number) => {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const nuevaCant = i.cantidad + delta;
          return nuevaCant > 0 ? { ...i, cantidad: nuevaCant } : i;
        }
        return i;
      }).filter((i) => i.cantidad > 0)
    );
  };

  const eliminarDelCarrito = (id: number) => {
    setCarrito((prev) => prev.filter((i) => i.id !== id));
  };

  // Cálculos Financieros
  const subtotal = useMemo(() => carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0), [carrito]);
  const valorFlete = useMemo(() => incluirFlete ? Math.round(subtotal * 0.2) : 0, [subtotal, incluirFlete]);
  const total = subtotal + valorFlete;

  const formatearCOP = (valor: number) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
  };

  // Guardar en Supabase
  const guardarPedidoEnSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCliente || !telefonoCliente) {
      alert("Por favor completa tu Nombre y Teléfono.");
      return;
    }

    setEnviando(true);
    try {
      const { error } = await supabase.from("pedidos").insert([
        {
          nombre_cliente: nombreCliente,
          nombre_vivero: nombreVivero || "Cliente Particular",
          ciudad_departamento: deptoDestino,
          telefono: telefonoCliente,
          direccion: direccionEnvio,
          items: carrito,
          subtotal,
          valor_flete: valorFlete,
          total,
          estado: "Pendiente"
        }
      ]);

      if (error) throw error;

      setExitoGuardado(true);
      setCarrito([]);
      setTimeout(() => {
        setMostrarModalForm(false);
        setExitoGuardado(false);
        setNombreCliente("");
        setNombreVivero("");
        setTelefonoCliente("");
        setDireccionEnvio("");
        setCarritoMovilAbierto(false);
      }, 2000);
    } catch (err) {
      console.error("Error al guardar en Supabase:", err);
      alert("Hubo un problema al guardar el pedido en la base de datos.");
    } finally {
      setEnviando(false);
    }
  };

  // Cargar Pedidos Guardados
  const cargarPedidosAdmin = useCallback(async () => {
    setCargandoPedidos(true);
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPedidosSupabase(data || []);
    } catch (err) {
      console.error("Error al obtener pedidos:", err);
    } finally {
      setCargandoPedidos(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (vista === "admin") {
      (async () => {
        if (isMounted) {
          await cargarPedidosAdmin();
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [vista, cargarPedidosAdmin]);

  const ejecutarImpresion = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 lg:pb-8">
      {/* Banner Superior Modo Demo */}
      <div className="bg-amber-600 text-white text-[11px] sm:text-xs font-semibold px-3 py-1.5 sm:py-2 flex items-center justify-between shadow-inner print:hidden">
        <div className="flex items-center space-x-1.5 truncate">
          <ShieldAlert className="w-4 h-4 text-amber-200 shrink-0" />
          <span className="truncate">
            <strong>DEMO B2B:</strong> Cotizaciones guardadas en tiempo real.
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setVista("catalogo")}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${vista === "catalogo" ? "bg-white text-amber-900 font-bold" : "hover:bg-amber-700"}`}
          >
            Catálogo
          </button>
          <button
            onClick={() => setVista("admin")}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${vista === "admin" ? "bg-white text-amber-900 font-bold" : "hover:bg-amber-700"}`}
          >
            <ClipboardList className="w-3 h-3" />
            <span className="hidden sm:inline">Panel Pedidos</span>
            <span className="sm:hidden">Pedidos</span>
          </button>
          <Link
            href="/estadisticas"
            className="px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 hover:bg-amber-700 bg-amber-700/60"
          >
            <BarChart3 className="w-3 h-3" />
            <span className="hidden sm:inline">Estadísticas</span>
          </Link>
        </div>
      </div>

      {/* Header Principal */}
      <header className="bg-emerald-900 text-white sticky top-0 z-40 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500 p-1.5 sm:p-2 rounded-lg">
              <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-950" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold tracking-tight leading-none">VIVERO CINCO SENTIDOS</h1>
              <p className="text-[10px] sm:text-xs text-emerald-300 mt-0.5">Pedidos Nacionales B2B 2026</p>
            </div>
          </div>
        </div>
      </header>

      {/* VISTA 1: CATÁLOGO DE PRODUCTOS */}
      {vista === "catalogo" ? (
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
          <section className="lg:col-span-8 space-y-4 sm:space-y-6">
            <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar planta (ej: Alocasia, Anturio, Begonia)..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Categoría:
                  </label>
                  <select
                    value={categoriaSel}
                    onChange={(e) => setCategoriaSel(e.target.value)}
                    className="w-full p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                  >
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Presentación:
                  </label>
                  <select
                    value={presentacionSel}
                    onChange={(e) => setPresentacionSel(e.target.value)}
                    className="w-full p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                  >
                    {presentaciones.map((pres) => (
                      <option key={pres} value={pres}>{pres}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {productosFiltrados.map((prod) => {
                const cantActual = cantidadesTarjeta[prod.id] || 1;
                return (
                  <div key={prod.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2 gap-1">
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 truncate">
                          {prod.categoria}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                          {prod.presentacion}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm mb-1 leading-snug">{prod.nombre}</h3>
                      <p className="text-base sm:text-lg font-extrabold text-emerald-800 mb-3">{formatearCOP(prod.precio)}</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-500">Unidades:</span>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            type="button"
                            onClick={() => manejarCambioCantTarjeta(prod.id, String(cantActual - 1))}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={cantActual}
                            onChange={(e) => manejarCambioCantTarjeta(prod.id, e.target.value)}
                            className="w-12 text-center bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => manejarCambioCantTarjeta(prod.id, String(cantActual + 1))}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => agregarAlCarrito(prod)}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Agregar {cantActual > 1 ? `(${cantActual})` : ""}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Resumen Lateral */}
          <section className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5 sticky top-20 space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-700" /> Resumen de Pedido
                </h2>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {carrito.reduce((acc, i) => acc + i.cantidad, 0)} plantas
                </span>
              </div>

              {carrito.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <ShoppingCart className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-xs">No has seleccionado plantas aún.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {carrito.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.nombre}</p>
                        <p className="text-[10px] text-slate-400">{item.presentacion} • {formatearCOP(item.precio)} c/u</p>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button onClick={() => cambiarCantidadBoton(item.id, -1)} className="w-5 h-5 bg-slate-200 rounded font-bold text-slate-700 flex items-center justify-center">-</button>
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => manejarCambioCantCarrito(item.id, e.target.value)}
                          className="w-10 text-center bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 py-0.5"
                        />
                        <button onClick={() => cambiarCantidadBoton(item.id, 1)} className="w-5 h-5 bg-slate-200 rounded font-bold text-slate-700 flex items-center justify-center">+</button>
                        <button onClick={() => eliminarDelCarrito(item.id)} className="text-red-500 ml-1 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incluirFlete}
                    onChange={(e) => setIncluirFlete(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-emerald-700" /> Incluir Flete Estimado (~20%)
                    </span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Ajustado al departamento de destino.</p>
                  </div>
                </label>
              </div>

              <div className="border-t pt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal Plantas:</span>
                  <span className="font-bold">{formatearCOP(subtotal)}</span>
                </div>
                {incluirFlete && (
                  <div className="flex justify-between">
                    <span>Flete Logístico (20%):</span>
                    <span className="font-bold text-emerald-800">{formatearCOP(valorFlete)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-900 border-t pt-2">
                  <span>Total Factura Estimada:</span>
                  <span className="text-emerald-800">{formatearCOP(total)}</span>
                </div>
              </div>

              <button
                disabled={carrito.length === 0}
                onClick={() => setMostrarModalForm(true)}
                className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Completar y Guardar Pedido</span>
              </button>
            </div>
          </section>
        </main>
      ) : (
        /* VISTA 2: PANEL DE ADMINISTRACIÓN Y CONTROL DE PEDIDOS POR RUTAS Y FECHAS */
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-6 print:hidden">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700" /> Control de Despachos y Rutas
              </h2>
              <p className="text-xs text-slate-500">Organiza y filtra los pedidos por semanas de despacho o departamentos de destino.</p>
            </div>
            <button
              onClick={cargarPedidosAdmin}
              className="px-3 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar Datos
            </button>
          </div>

          {/* BARRA DE FILTROS LOGÍSTICOS POR FECHA Y DEPARTAMENTO */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 border-b pb-2 text-xs font-bold text-slate-700">
              <Filter className="w-4 h-4 text-emerald-700" /> Filtros de Consolidado Semanal:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Filtro de Fechas */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Rango de Fecha:
                </label>
                <select
                  value={filtroFechaRango}
                  onChange={(e) => setFiltroFechaRango(e.target.value as "todos" | "hoy" | "semana" | "mes")}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="todos">Todas las Fechas</option>
                  <option value="hoy">Registrados Hoy</option>
                  <option value="semana">Esta Semana (Lunes a Domingo)</option>
                  <option value="mes">Este Mes</option>
                </select>
              </div>

              {/* 2. Filtro de Departamento / Ruta */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" /> Departamento / Ruta:
                </label>
                <select
                  value={filtroDeptoAdmin}
                  onChange={(e) => setFiltroDeptoAdmin(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Todos">Todos los Departamentos</option>
                  {DEPARTAMENTOS_COLOMBIA.map((dep) => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>

              {/* 3. Buscador por Nombre de Cliente o Vivero */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-700" /> Cliente / Vivero:
                </label>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busquedaClienteAdmin}
                  onChange={(e) => setBusquedaClienteAdmin(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Contador de Consolidado */}
            <div className="flex justify-between items-center pt-2 text-xs border-t text-slate-600">
              <span>
                Mostrando <strong>{pedidosFiltradosAdmin.length}</strong> pedido(s) programados
              </span>
              <span className="font-extrabold text-emerald-800">
                Total Ruta: {formatearCOP(pedidosFiltradosAdmin.reduce((acc, p) => acc + p.total, 0))}
              </span>
            </div>
          </div>

          {cargandoPedidos ? (
            <div className="text-center py-12 text-slate-400 text-xs">Cargando pedidos guardados...</div>
          ) : pedidosFiltradosAdmin.length === 0 ? (
            <div className="bg-white p-8 rounded-xl text-center border border-slate-200 text-slate-500 text-xs space-y-2">
              <p className="font-semibold text-slate-700">No se encontraron pedidos con el filtro seleccionado.</p>
              <p className="text-[11px] text-slate-400">Prueba cambiando el rango de fecha o seleccionando &quot;Todas las Fechas&quot;.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pedidosFiltradosAdmin.map((ped) => (
                <div key={ped.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap justify-between items-start border-b pb-3 gap-2">
                    <div>
                      <span className="text-[10px] sm:text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Pedido #{ped.id}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base mt-1 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-500" /> {ped.nombre_cliente}
                        {ped.nombre_vivero && (
                          <span className="text-xs font-normal text-slate-500 flex items-center gap-1">
                            • <Store className="w-3.5 h-3.5" /> {ped.nombre_vivero}
                          </span>
                        )}
                      </h3>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPedidoParaImprimir(ped)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Ver Factura / Imprimir</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span><strong>Destino:</strong> {ped.ciudad_departamento} {ped.direccion && `(${ped.direccion})`}</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-xs">
                    <p className="font-bold text-slate-700 mb-1">Especies Solicitadas:</p>
                    {ped.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-600">
                        <span>{it.cantidad}x {it.nombre} ({it.presentacion})</span>
                        <span className="font-semibold">{formatearCOP(it.precio * it.cantidad)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t">
                    <span className="text-slate-500 text-[11px]">
                      Subtotal: {formatearCOP(ped.subtotal)} + Flete: {formatearCOP(ped.valor_flete)}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-800">
                      Total: {formatearCOP(ped.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* BARRA FLOTANTE MÓVIL */}
      {vista === "catalogo" && carrito.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-emerald-950 text-white p-3 z-40 border-t border-emerald-800 shadow-2xl flex items-center justify-between print:hidden">
          <div>
            <div className="flex items-center space-x-1.5 text-emerald-300 text-xs">
              <ShoppingCart className="w-4 h-4" />
              <span>{carrito.reduce((acc, i) => acc + i.cantidad, 0)} plantas agregadas</span>
            </div>
            <p className="text-base font-extrabold text-white leading-tight">{formatearCOP(total)}</p>
          </div>
          <button
            onClick={() => setCarritoMovilAbierto(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shadow"
          >
            <span>Ver Pedido</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL MÓVIL */}
      {carritoMovilAbierto && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/70 z-50 flex flex-col justify-end print:hidden">
          <div className="bg-white rounded-t-2xl p-5 max-h-[85vh] flex flex-col justify-between space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <ShoppingCart className="w-5 h-5 text-emerald-700" /> Tu Pedido ({carrito.reduce((acc, i) => acc + i.cantidad, 0)} un)
              </h3>
              <button onClick={() => setCarritoMovilAbierto(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 max-h-60 pr-1">
              {carrito.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{item.nombre}</p>
                    <p className="text-[10px] text-slate-400">{item.presentacion} • {formatearCOP(item.precio)} c/u</p>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button onClick={() => cambiarCantidadBoton(item.id, -1)} className="w-6 h-6 bg-slate-200 rounded font-bold text-slate-700 flex items-center justify-center">-</button>
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => manejarCambioCantCarrito(item.id, e.target.value)}
                      className="w-12 text-center bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 py-1"
                    />
                    <button onClick={() => cambiarCantidadBoton(item.id, 1)} className="w-6 h-6 bg-slate-200 rounded font-bold text-slate-700 flex items-center justify-center">+</button>
                    <button onClick={() => eliminarDelCarrito(item.id)} className="text-red-500 ml-1 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirFlete}
                  onChange={(e) => setIncluirFlete(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-700" /> Incluir Flete Estimado (~20%)
                  </span>
                </div>
              </label>
            </div>

            <div className="border-t pt-2 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal Plantas:</span>
                <span className="font-bold">{formatearCOP(subtotal)}</span>
              </div>
              {incluirFlete && (
                <div className="flex justify-between">
                  <span>Flete (20%):</span>
                  <span className="font-bold text-emerald-800">{formatearCOP(valorFlete)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t pt-1.5">
                <span>Total Factura:</span>
                <span className="text-emerald-800">{formatearCOP(total)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setCarritoMovilAbierto(false);
                setMostrarModalForm(true);
              }}
              className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Diligenciar y Enviar Pedido</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO DE ENVÍO */}
      {mostrarModalForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-700" /> Datos de Despacho para Cotización
            </h3>

            {exitoGuardado ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-bold text-emerald-900 text-sm">¡Pedido Guardado en Supabase!</p>
                <p className="text-xs text-emerald-700">
                  Puedes revisarlo en tiempo real ingresando a la pestaña &quot;Panel Pedidos Recibidos&quot;.
                </p>
              </div>
            ) : (
              <form onSubmit={guardarPedidoEnSupabase} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Mendoza"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Vivero / Empresa (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Vivero Jardines del Sur"
                    value={nombreVivero}
                    onChange={(e) => setNombreVivero(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej. 310 123 4567"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" /> Departamento de Destino *
                  </label>
                  <select
                    value={deptoDestino}
                    onChange={(e) => setDeptoDestino(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {DEPARTAMENTOS_COLOMBIA.map((dep) => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de Entrega / Municipio (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Calle 10 # 15-20, Barrio El Jardín"
                    value={direccionEnvio}
                    onChange={(e) => setDireccionEnvio(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 text-slate-600 border border-slate-200">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Destino:</span>
                    <span className="text-emerald-800">{deptoDestino}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal Plantas:</span>
                    <span>{formatearCOP(subtotal)}</span>
                  </div>
                  {incluirFlete && (
                    <div className="flex justify-between text-slate-500">
                      <span>Flete Nacional (20%):</span>
                      <span>{formatearCOP(valorFlete)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-emerald-800 text-sm pt-1 border-t">
                    <span>Total Estimado:</span>
                    <span>{formatearCOP(total)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMostrarModalForm(false)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-1/2 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold disabled:bg-slate-300"
                  >
                    {enviando ? "Guardando..." : "Confirmar y Guardar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN */}
      {pedidoParaImprimir && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:p-0 print:w-full">
            <div className="flex justify-between items-start border-b-2 border-emerald-900 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Leaf className="w-6 h-6 text-emerald-800 print:text-black" />
                  <h2 className="text-xl font-black text-emerald-950 uppercase tracking-tight">VIVERO CINCO SENTIDOS S.A.S.</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  NIT: 900.123.456-7 • Cundinamarca, Colombia<br />
                  Tel: +57 313 430 4435 • ventas@viverocincosentidos.com
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-emerald-100 text-emerald-900 font-bold text-xs px-3 py-1 rounded-full border border-emerald-300 print:border-black print:bg-slate-100">
                  REMISIÓN DE DESPACHO
                </span>
                <p className="text-sm font-extrabold text-slate-800 mt-2">
                  N° PEDIDO #{pedidoParaImprimir.id}
                </p>
                <p className="text-[11px] text-slate-500">
                  Fecha: {new Date(pedidoParaImprimir.created_at).toLocaleString("es-CO")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs print:bg-slate-50 print:border-slate-300">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px] mb-1">Cliente / Comprador:</p>
                <p className="font-bold text-slate-800 text-sm">{pedidoParaImprimir.nombre_cliente}</p>
                {pedidoParaImprimir.nombre_vivero && (
                  <p className="text-slate-600 font-medium">Vivero/Empresa: {pedidoParaImprimir.nombre_vivero}</p>
                )}
                <p className="text-slate-600">Teléfono: {pedidoParaImprimir.telefono}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px] mb-1">Destino de Despacho:</p>
                <p className="font-bold text-slate-800 text-sm">{pedidoParaImprimir.ciudad_departamento}</p>
                <p className="text-slate-600">{pedidoParaImprimir.direccion || "Dirección registrada por asesor"}</p>
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-800 text-xs mb-2 uppercase tracking-wider">Detalle del Pedido de Plantas:</p>
              <table className="w-full text-left text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-emerald-900 text-white print:bg-slate-200 print:text-black">
                    <th className="p-2 border border-slate-300 text-center w-12">Cant.</th>
                    <th className="p-2 border border-slate-300">Especie / Planta</th>
                    <th className="p-2 border border-slate-300 text-center">Presentación</th>
                    <th className="p-2 border border-slate-300 text-right">Precio Unit.</th>
                    <th className="p-2 border border-slate-300 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidoParaImprimir.items?.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 border border-slate-200 text-center font-bold">{it.cantidad}</td>
                      <td className="p-2 border border-slate-200 font-semibold text-slate-800">{it.nombre}</td>
                      <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-600">{it.presentacion}</td>
                      <td className="p-2 border border-slate-200 text-right">{formatearCOP(it.precio)}</td>
                      <td className="p-2 border border-slate-200 text-right font-bold">{formatearCOP(it.precio * it.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-end pt-2">
              <div className="text-[10px] text-slate-400 max-w-xs leading-tight">
                * Las plantas vivas viajan empaquetadas en huacales/cajas especiales.<br />
                * Documento generado como soporte oficial de pedido.
              </div>
              <div className="w-64 space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span>Subtotal Especies:</span>
                  <span className="font-bold">{formatearCOP(pedidoParaImprimir.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flete Logístico (20%):</span>
                  <span className="font-bold">{formatearCOP(pedidoParaImprimir.valor_flete)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-emerald-950 border-t pt-1 border-slate-300">
                  <span>Total a Pagar:</span>
                  <span>{formatearCOP(pedidoParaImprimir.total)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 border-t text-center text-xs text-slate-500">
              <div>
                <div className="border-b border-slate-400 mb-1 h-8"></div>
                <p className="font-semibold">Empacado y Revisado por</p>
                <p className="text-[10px]">Logística Vivero Cinco Sentidos</p>
              </div>
              <div>
                <div className="border-b border-slate-400 mb-1 h-8"></div>
                <p className="font-semibold">Recibido Conforme por</p>
                <p className="text-[10px]">Transportador / Cliente</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t print:hidden">
              <button
                onClick={() => setPedidoParaImprimir(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Cerrar
              </button>
              <button
                onClick={ejecutarImpresion}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir o Guardar como PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}