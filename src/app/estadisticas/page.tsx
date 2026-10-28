"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  MapPin, 
  Calendar, 
  ArrowUpRight,
  Leaf,
  RefreshCw,
  Printer,
  ChevronLeft
} from "lucide-react";
import Link from "next/link";

interface ItemPedido {
  id: number;
  nombre: string;
  presentacion: string;
  precio: number;
  cantidad: number;
  categoria?: string;
}

interface Pedido {
  id: number;
  created_at: string;
  nombre_cliente: string;
  nombre_vivero?: string;
  ciudad_departamento: string;
  telefono: string;
  items: ItemPedido[];
  subtotal: number;
  valor_flete: number;
  total: number;
  estado: string;
}

export default function EstadisticasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rangoFecha, setRangoFecha] = useState<"todos" | "hoy" | "semana" | "mes">("todos");

  // Función para recargar manualmente desde el botón
  const obtenerPedidos = useCallback(async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (err) {
      console.error("Error al cargar estadísticas:", err);
    } finally {
      setCargando(false);
    }
  }, []);

  // Sincronización inicial limpia para evitar rerenders en cascada
  useEffect(() => {
    let cancelado = false;

    async function cargarInicial() {
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!cancelado) {
          setPedidos(data || []);
        }
      } catch (err) {
        console.error("Error al cargar datos en efecto:", err);
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    cargarInicial();

    return () => {
      cancelado = true;
    };
  }, []);

  const formatearCOP = (valor: number): string => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(valor);
  };

  // Filtrado de pedidos según rango seleccionado
  const pedidosFiltrados = useMemo(() => {
    if (rangoFecha === "todos") return pedidos;

    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    const diaSemana = ahora.getDay() || 7;
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - diaSemana + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    return pedidos.filter((p) => {
      const fechaPed = new Date(p.created_at);
      if (rangoFecha === "hoy") return fechaPed >= inicioHoy;
      if (rangoFecha === "semana") return fechaPed >= inicioSemana;
      if (rangoFecha === "mes") return fechaPed >= inicioMes;
      return true;
    });
  }, [pedidos, rangoFecha]);

  // KPIs
  const totalVentas = useMemo(() => pedidosFiltrados.reduce((acc, p) => acc + Number(p.total || 0), 0), [pedidosFiltrados]);
  const totalPedidos = pedidosFiltrados.length;
  const promedioPedido = totalPedidos > 0 ? totalVentas / totalPedidos : 0;
  
  const totalPlantasVendidas = useMemo(() => {
    return pedidosFiltrados.reduce((acc, p) => {
      const itemsArray = Array.isArray(p.items) ? p.items : [];
      const cantItems = itemsArray.reduce((subAcc, item) => subAcc + Number(item.cantidad || 0), 0);
      return acc + cantItems;
    }, 0);
  }, [pedidosFiltrados]);

  // Agrupamiento por Departamento
  const ventasPorDepartamento = useMemo(() => {
    const mapa: { [depto: string]: { total: number; cantidadPedidos: number } } = {};
    
    pedidosFiltrados.forEach((p) => {
      const depto = p.ciudad_departamento || "No Especificado";
      if (!mapa[depto]) {
        mapa[depto] = { total: 0, cantidadPedidos: 0 };
      }
      mapa[depto].total += Number(p.total || 0);
      mapa[depto].cantidadPedidos += 1;
    });

    return Object.entries(mapa)
      .map(([departamento, stats]) => ({ departamento, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  // Top Especies
  const topPlantas = useMemo(() => {
    const mapa: { [nombre: string]: { cantidad: number; recaudado: number } } = {};

    pedidosFiltrados.forEach((p) => {
      const itemsArray = Array.isArray(p.items) ? p.items : [];
      itemsArray.forEach((item) => {
        const key = item.presentacion ? `${item.nombre} (${item.presentacion})` : item.nombre;
        const cant = Number(item.cantidad || 0);
        const prec = Number(item.precio || 0);

        if (!mapa[key]) {
          mapa[key] = { cantidad: 0, recaudado: 0 };
        }
        mapa[key].cantidad += cant;
        mapa[key].recaudado += prec * cant;
      });
    });

    return Object.entries(mapa)
      .map(([nombre, stats]) => ({ nombre, ...stats }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }, [pedidosFiltrados]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 print:hidden">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-emerald-950 flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-emerald-700" /> Dashboard de Ventas
              </h1>
              <p className="text-xs text-slate-500">
                Resumen analítico de cotizaciones y despachos en Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={obtenerPedidos}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-700 ${cargando ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Imprimir Reporte
            </button>
          </div>
        </div>

        {/* Filtros de Tiempo */}
        <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm print:hidden">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Periodo:</span>
          </div>
          <div className="flex gap-1.5">
            {(["todos", "hoy", "semana", "mes"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRangoFecha(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                  rangoFecha === r
                    ? "bg-emerald-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r === "todos" ? "Histórico Completo" : r}
              </button>
            ))}
          </div>
        </div>

        {/* Tarjetas KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Ventas Totales</span>
              <DollarSign className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded-md" />
            </div>
            <p className="text-2xl font-black text-slate-900">{formatearCOP(totalVentas)}</p>
            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> Facturación
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Pedidos</span>
              <ShoppingBag className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded-md" />
            </div>
            <p className="text-2xl font-black text-slate-900">{totalPedidos}</p>
            <span className="text-[10px] text-slate-500 font-medium">Cotizaciones en BD</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Plantas Vendidas</span>
              <Leaf className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded-md" />
            </div>
            <p className="text-2xl font-black text-slate-900">{totalPlantasVendidas} un.</p>
            <span className="text-[10px] text-slate-500 font-medium">Unidades en pedidos</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Ticket Promedio</span>
              <TrendingUp className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded-md" />
            </div>
            <p className="text-2xl font-black text-slate-900">{formatearCOP(promedioPedido)}</p>
            <span className="text-[10px] text-slate-500 font-medium">Promedio por pedido</span>
          </div>
        </div>

        {/* Tablas de Rendimiento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b pb-3">
              <MapPin className="w-4 h-4 text-emerald-700" /> Despachos por Departamento / Ruta
            </h3>

            {ventasPorDepartamento.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin registros en este periodo.</p>
            ) : (
              <div className="space-y-3">
                {ventasPorDepartamento.map((d, i) => {
                  const porcentaje = totalVentas > 0 ? (d.total / totalVentas) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-800">{d.departamento} ({d.cantidadPedidos} pedido)</span>
                        <span className="text-emerald-800">{formatearCOP(d.total)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-700 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b pb-3">
              <Leaf className="w-4 h-4 text-emerald-700" /> Top Plantas Solicitadas
            </h3>

            {topPlantas.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin registros en este periodo.</p>
            ) : (
              <div className="space-y-3">
                {topPlantas.map((plant, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 bg-emerald-100 text-emerald-800 font-black rounded-lg flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{plant.nombre}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-slate-900">{plant.cantidad} un.</p>
                      <p className="text-[10px] text-slate-500">{formatearCOP(plant.recaudado)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}