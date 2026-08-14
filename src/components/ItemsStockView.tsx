import React, { useState } from "react";
import { ERPState, Item, LedgerEntry } from "../types";
import { formatINR, getConversionFactor } from "../utils";
import { Plus, Search, Edit2, AlertTriangle, CheckCircle, Package, Globe, Trash2, X, Copy } from "lucide-react";

interface ItemsStockViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

export default function ItemsStockView({ state, onUpdateState }: ItemsStockViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"catalog" | "conversions">("catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states for creating/editing
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Grains");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const defaultCategories = ["Grains", "Groceries", "Edible Oils", "Spices"];
  const allCategories = state.customCategories && state.customCategories.length > 0
    ? state.customCategories
    : defaultCategories;

  const handleAddNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      alert("Category name cannot be empty.");
      return;
    }
    if (!allCategories.includes(trimmed)) {
      onUpdateState({...state, customCategories: [...allCategories, trimmed]});
    }
    setCategory(trimmed);
    setNewCategoryName("");
    setIsAddingNewCategory(false);
  };

  // States and Handlers for Inline Category Edit/Delete operations
  const [showInlineCategoryModal, setShowInlineCategoryModal] = useState(false);
  const [inlineCategoryMode, setInlineCategoryMode] = useState<"create" | "edit">("create");
  const [inlineCategoryValue, setInlineCategoryValue] = useState("");
  const [inlineOriginalCategoryValue, setInlineOriginalCategoryValue] = useState("");

  const handleAddCategoryInline = () => {
    setInlineCategoryMode("create");
    setInlineCategoryValue("");
    setShowInlineCategoryModal(true);
  };

  const handleEditCategoryInline = () => {
    if (!category) return;
    setInlineCategoryMode("edit");
    setInlineCategoryValue(category);
    setInlineOriginalCategoryValue(category);
    setShowInlineCategoryModal(true);
  };

  const handleDeleteCategoryInline = () => {
    if (!category) return;

    if (
      confirm(
        `Are you sure you want to delete category "${category}"? This will also update any items currently mapped to this category.`
      )
    ) {
      const fallback = allCategories.find((c) => c !== category) || "Grains";
      const updatedItems = state.items.map((item) => {
        if (item.category === category) {
          return { ...item, category: fallback };
        }
        return item;
      });

      onUpdateState({
        ...state,
        customCategories: allCategories.filter((cat) => cat !== category),
        items: updatedItems,
      });
      
      setCategory(fallback);
    }
  };

  const handleSaveInlineCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inlineCategoryValue.trim();
    if (!trimmed) {
      alert("Category name cannot be empty.");
      return;
    }

    if (inlineCategoryMode === "create") {
      if (!allCategories.includes(trimmed)) {
        onUpdateState({...state, customCategories: [...allCategories, trimmed]});
      }
      setCategory(trimmed);
    } else {
      const original = inlineOriginalCategoryValue;
      if (original === trimmed) {
        setShowInlineCategoryModal(false);
        return;
      }

      if (allCategories.includes(trimmed) && trimmed !== original) {
        alert(`The category "${trimmed}" already exists.`);
        return;
      }

      const nextCategories = allCategories.map((c) => (c === original ? trimmed : c));

      if (category === original) setCategory(trimmed);

      const updatedItems = state.items.map((item) => {
        if (item.category === original) {
          return { ...item, category: trimmed };
        }
        return item;
      });

      onUpdateState({
        ...state,
        customCategories: nextCategories,
        items: updatedItems,
      });
    }

    setShowInlineCategoryModal(false);
  };

  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  const defaultUnits = ["Bags", "Tins", "Pcs", "Kgs", "Liters", "g", "kg", "L", "ml", "Box", "Piece", "Dozen"];
  const allUnits = state.customUnits && state.customUnits.length > 0
    ? state.customUnits
    : defaultUnits;

  const handleAddNewUnit = () => {
    const trimmed = newUnitName.trim();
    if (!trimmed) {
      alert("Unit of Measure cannot be empty.");
      return;
    }
    if (!allUnits.includes(trimmed)) {
      onUpdateState({...state, customUnits: [...allUnits, trimmed]});
    }
    setUnit(trimmed);
    setNewUnitName("");
    setIsAddingNewUnit(false);
  };
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [unit, setUnit] = useState("Bags");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [salesUnit, setSalesUnit] = useState("");
  const [minStockLevel, setMinStockLevel] = useState(10);
  const [itemTaxType, setItemTaxType] = useState<"GST" | "NON_GST">("GST");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState<number>(18);

  // States for inline unit registration/modification modal
  const [showInlineUnitModal, setShowInlineUnitModal] = useState(false);
  const [inlineUnitMode, setInlineUnitMode] = useState<"create" | "edit">("create");
  const [inlineUnitField, setInlineUnitField] = useState<"purchase" | "sales">("purchase");
  const [inlineUnitValue, setInlineUnitValue] = useState("");
  const [inlineOriginalUnitValue, setInlineOriginalUnitValue] = useState("");

  const handleAddUnitInline = (field: "purchase" | "sales") => {
    setInlineUnitField(field);
    setInlineUnitMode("create");
    setInlineUnitValue("");
    setShowInlineUnitModal(true);
  };

  const handleEditUnitInline = (field: "purchase" | "sales") => {
    const currentVal = field === "purchase" ? purchaseUnit : salesUnit;
    if (!currentVal) return;
    setInlineUnitField(field);
    setInlineUnitMode("edit");
    setInlineUnitValue(currentVal);
    setInlineOriginalUnitValue(currentVal);
    setShowInlineUnitModal(true);
  };

  const handleDeleteUnitInline = (field: "purchase" | "sales") => {
    const currentVal = field === "purchase" ? purchaseUnit : salesUnit;
    if (!currentVal) return;

    if (
      confirm(
        `Are you sure you want to delete unit "${currentVal}"? This will also remove it from any items or unit conversion rules using it.`
      )
    ) {
      const fallback = allUnits.find(unitVal => unitVal !== currentVal) || "Bags";
      const updatedItems = state.items.map((item) => {
        const newItem = { ...item };
        if (newItem.unit === currentVal) newItem.unit = fallback;
        if (newItem.purchaseUnit === currentVal) newItem.purchaseUnit = undefined;
        if (newItem.salesUnit === currentVal) newItem.salesUnit = undefined;
        return newItem;
      });

      const updatedConversions = (state.unitConversions || []).filter(
        (c) => c.fromUnit !== currentVal && c.toUnit !== currentVal
      );

      onUpdateState({
        ...state,
        customUnits: allUnits.filter((u) => u !== currentVal),
        items: updatedItems,
        unitConversions: updatedConversions,
      });

      if (unit === currentVal) setUnit(fallback);
      if (field === "purchase") {
        setPurchaseUnit("");
      } else {
        setSalesUnit("");
      }
    }
  };

  const handleSaveInlineUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inlineUnitValue.trim();
    if (!trimmed) {
      alert("Unit name cannot be empty.");
      return;
    }

    if (inlineUnitMode === "create") {
      if (!allUnits.includes(trimmed)) {
        onUpdateState({...state, customUnits: [...allUnits, trimmed]});
      }
      if (inlineUnitField === "purchase") {
        setPurchaseUnit(trimmed);
      } else {
        setSalesUnit(trimmed);
      }
    } else {
      const original = inlineOriginalUnitValue;
      if (original === trimmed) {
        setShowInlineUnitModal(false);
        return;
      }

      if (allUnits.includes(trimmed) && trimmed !== original) {
        alert(`The unit "${trimmed}" already exists.`);
        return;
      }

      const nextUnits = allUnits.map((u) => (u === original ? trimmed : u));

      if (purchaseUnit === original) setPurchaseUnit(trimmed);
      if (salesUnit === original) setSalesUnit(trimmed);
      if (unit === original) setUnit(trimmed);

      const updatedItems = state.items.map((item) => {
        const newItem = { ...item };
        if (newItem.unit === original) newItem.unit = trimmed;
        if (newItem.purchaseUnit === original) newItem.purchaseUnit = trimmed;
        if (newItem.salesUnit === original) newItem.salesUnit = trimmed;
        return newItem;
      });

      const updatedConversions = (state.unitConversions || []).map((c) => {
        const newC = { ...c };
        if (newC.fromUnit === original) newC.fromUnit = trimmed;
        if (newC.toUnit === original) newC.toUnit = trimmed;
        return newC;
      });

      onUpdateState({
        ...state,
        customUnits: nextUnits,
        items: updatedItems,
        unitConversions: updatedConversions,
      });
    }

    setShowInlineUnitModal(false);
  };

  const [newFromUnit, setNewFromUnit] = useState("");
  const [newToUnit, setNewToUnit] = useState("");
  const [newFactor, setNewFactor] = useState<number | "">("");

  const filteredItems = (state.items || []).filter(
    (item) => {
      if (!item) return false;
      const nameStr = String(item.name || "").toLowerCase();
      const codeStr = String(item.code || "").toLowerCase();
      const categoryStr = String(item.category || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      return nameStr.includes(search) || codeStr.includes(search) || categoryStr.includes(search);
    }
  );

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description);
    setCategory(item.category);
    setPurchasePrice(item.purchasePrice);
    setSalePrice(item.salePrice);
    setStockQuantity(item.stockQuantity);
    setUnit(item.unit);
    setPurchaseUnit(item.purchaseUnit || "");
    setSalesUnit(item.salesUnit || "");
    setMinStockLevel(item.minStockLevel);
    setItemTaxType(item.item_tax_type || "GST");
    setHsnCode(item.hsnCode || "");
    setGstRate(item.gstRate !== undefined ? item.gstRate : 18);
    setIsCreating(true);
  };

  const handleDuplicateClick = (item: Item) => {
    setEditingItem(null);
    setCode(item.code + "-COPY");
    setName(item.name + " (Copy)");
    setDescription(item.description || "");
    setCategory(item.category);
    setPurchasePrice(item.purchasePrice);
    setSalePrice(item.salePrice);
    setStockQuantity(item.stockQuantity);
    setUnit(item.unit);
    setPurchaseUnit(item.purchaseUnit || "");
    setSalesUnit(item.salesUnit || "");
    setMinStockLevel(item.minStockLevel);
    setItemTaxType(item.item_tax_type || "GST");
    setHsnCode(item.hsnCode || "");
    setGstRate(item.gstRate !== undefined ? item.gstRate : 18);
    setIsCreating(true);
  };

  const handleCreateClick = () => {
    setEditingItem(null);
    setCode(`DT-ITEM-00${state.items.length + 1}`);
    setName("");
    setDescription("");
    setCategory("Grains");
    setPurchasePrice(100);
    setSalePrice(120);
    setStockQuantity(0);
    setUnit("Bags");
    setPurchaseUnit("");
    setSalesUnit("");
    setMinStockLevel(10);
    setItemTaxType("GST");
    setHsnCode("");
    setGstRate(18);
    setIsCreating(true);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      alert("SKU Code and Name are required.");
      return;
    }

    if (itemTaxType === "GST" && !hsnCode) {
      alert("HSN Code is required for GST Items.");
      return;
    }

    let updatedItems = [...state.items];

    if (editingItem) {
      // Edit
      updatedItems = updatedItems.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            code,
            name,
            description,
            category,
            purchasePrice,
            salePrice,
            stockQuantity,
            unit,
            purchaseUnit: purchaseUnit || undefined,
            salesUnit: salesUnit || undefined,
            minStockLevel,
            item_tax_type: itemTaxType,
            hsnCode: itemTaxType === "NON_GST" ? null : hsnCode,
            gstRate: itemTaxType === "NON_GST" ? 0 : gstRate,
          };
        }
        return item;
      });
    } else {
      // Create new
      const newItem: Item = {
        id: "i-" + Math.random().toString(36).substring(2, 9),
        code,
        name,
        description,
        category,
        purchasePrice,
        salePrice,
        stockQuantity,
        unit,
        purchaseUnit: purchaseUnit || undefined,
        salesUnit: salesUnit || undefined,
        minStockLevel,
        item_tax_type: itemTaxType,
        hsnCode: itemTaxType === "NON_GST" ? null : hsnCode,
        gstRate: itemTaxType === "NON_GST" ? 0 : gstRate,
      };
      updatedItems.push(newItem);
    }

    onUpdateState({ ...state, items: updatedItems });
    setIsCreating(false);
    setEditingItem(null);
  };

  // Save conversion rule handler
  const handleAddConversionRule = (e: React.FormEvent) => {
    e.preventDefault();
    const from = newFromUnit.trim();
    const to = newToUnit.trim();
    const fact = Number(newFactor);

    if (!from || !to || !fact || isNaN(fact) || fact <= 0) {
      alert("Please enter valid From Unit, To Unit, and a positive factor.");
      return;
    }

    // Check if duplicate already exists
    const conversions = state.unitConversions || [];
    const exists = conversions.some(c => c.fromUnit.toLowerCase() === from.toLowerCase() && c.toUnit.toLowerCase() === to.toLowerCase());
    if (exists) {
      alert(`A conversion rule from ${from} to ${to} already exists.`);
      return;
    }

    const newRule = {
      id: "uc-" + Math.random().toString(36).substring(2, 9),
      fromUnit: from,
      toUnit: to,
      factor: fact
    };

    onUpdateState({
      ...state,
      unitConversions: [...conversions, newRule]
    });

    setNewFromUnit("");
    setNewToUnit("");
    setNewFactor("");
  };

  const handleDeleteConversionRule = (id: string) => {
    if (confirm("Are you sure you want to delete this conversion rule?")) {
      const conversions = state.unitConversions || [];
      onUpdateState({
        ...state,
        unitConversions: conversions.filter(c => c.id !== id)
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Item Master & Unit Conversion</h2>
          <p className="text-sm text-gray-500">Configure products, base and transactional units, and master conversion rules.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-gray-100 p-0.5 border">
            <button
              onClick={() => { setActiveSubTab("catalog"); setIsCreating(false); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === "catalog"
                  ? "bg-white text-emerald-800 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-950"
              }`}
            >
              Product Catalog
            </button>
            <button
              onClick={() => { setActiveSubTab("conversions"); setIsCreating(false); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === "conversions"
                  ? "bg-white text-emerald-800 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-950"
              }`}
            >
              Unit Conversion Rules
            </button>
          </div>

          {activeSubTab === "catalog" && !isCreating && (
            <button
              onClick={handleCreateClick}
              className="px-4 py-2 bg-[#002f1d] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#00472c] transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus size={16} /> Add SKU
            </button>
          )}
        </div>
      </div>

      {activeSubTab === "catalog" && (
        <>
          {/* Create / Edit Form */}
          {isCreating && (
        <form onSubmit={handleSubmitItem} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
            {editingItem ? `Edit SKU ${editingItem.code}` : "Add New Stock Product"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">SKU Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="E.g., DT-RICE-001"
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., Premium Basmati Rice"
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-600 uppercase">Category *</label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={handleAddCategoryInline}
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                  >
                    <Plus size={10} /> Add New
                  </button>
                  {category && (
                    <>
                      <button
                        type="button"
                        onClick={handleEditCategoryInline}
                        className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Edit2 size={10} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCategoryInline}
                        className="text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer"
              >
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "Grains" ? "Grains & Pulses" :
                     cat === "Groceries" ? "General Groceries" :
                     cat === "Edible Oils" ? "Edible Oils" :
                     cat === "Spices" ? "Spices & Condiments" : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Product Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a detailed description of packaging standards, aging details, or origin states..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Tax Information Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Item Tax Type *</label>
              <select
                value={itemTaxType}
                onChange={(e) => setItemTaxType(e.target.value as any)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer font-semibold text-gray-700"
              >
                <option value="GST">GST Item</option>
                <option value="NON_GST">Non-GST Item</option>
              </select>
            </div>

            {itemTaxType === "GST" && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-gray-600 uppercase">HSN Code *</label>
                    <a
                      href="https://services.gst.gov.in/services/searchhsn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Open India GST portal HSN/SAC search in new tab"
                    >
                      <Globe size={11} /> Look up HSN Online
                    </a>
                  </div>
                  <input
                    type="text"
                    required
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="E.g., 10063010"
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">GST Rate (%) *</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer font-mono font-bold"
                  >
                    <option value="0">0% (Nil Rated / Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Standard Purchase Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={purchasePrice || ""}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Standard Selling Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={salePrice || ""}
                onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-bold text-emerald-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-600 uppercase">Purchase Unit (Optional)</label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleAddUnitInline("purchase")}
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                  >
                    <Plus size={10} /> Add New
                  </button>
                  {purchaseUnit && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditUnitInline("purchase")}
                        className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Edit2 size={10} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnitInline("purchase")}
                        className="text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <select
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">-- Same as Base Unit --</option>
                {allUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-600 uppercase">Sales Unit (Optional)</label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleAddUnitInline("sales")}
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                  >
                    <Plus size={10} /> Add New
                  </button>
                  {salesUnit && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditUnitInline("sales")}
                        className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Edit2 size={10} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnitInline("sales")}
                        className="text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <select
                value={salesUnit}
                onChange={(e) => setSalesUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">-- Same as Base Unit --</option>
                {allUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Minimum Stock Alert Threshold</label>
              <input
                type="number"
                min="0"
                required
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                Initial Stock Balance (In Base Unit) {editingItem && "(Manual Override)"}
              </label>
              <input
                type="number"
                min="0"
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-semibold text-gray-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-800 hover:bg-[#002f1d] text-[#f9f6f0] rounded-lg text-sm font-bold shadow-sm cursor-pointer"
            >
              Save Product Information
            </button>
          </div>
        </form>
      )}

      {/* Catalog Directory List */}
      {!isCreating && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search SKU code, name, category..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
              />
            </div>
            <span className="text-xs text-gray-400 font-mono">
              Total Catalog SKUs: {state.items.length} products
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">No catalog items matched your query.</p>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[300px] relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                    <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">SKU / Item Code</th>
                    <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Product Details</th>
                    <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Category</th>
                    <th className="p-4 text-right bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Purchase Cost</th>
                    <th className="p-4 text-right bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Selling Rate</th>
                    <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Current Stock</th>
                    <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Alert Status</th>
                    <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  {filteredItems.map((item) => {
                    const isLowStock = item.stockQuantity <= item.minStockLevel;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/40">
                        <td className="p-4 font-bold font-mono text-gray-900">{item.code}</td>
                        <td className="p-4">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-[10px] text-gray-400 max-w-sm truncate">{item.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">Base: {item.unit}</span>
                            {item.purchaseUnit && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Purchase: {item.purchaseUnit}</span>}
                            {item.salesUnit && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">Sales: {item.salesUnit}</span>}
                          </div>
                          <p className="text-[10px] font-mono mt-1.5 text-slate-500 font-semibold">
                            {item.item_tax_type === "NON_GST" ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Non-GST Item · 0%</span>
                            ) : (
                              <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">GST Item · HSN: {item.hsnCode || "N/A"} · {item.gstRate !== undefined ? item.gstRate : 18}%</span>
                            )}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono">
                          <div>{item.purchasePrice < 1 ? `₹${item.purchasePrice.toFixed(2)}` : formatINR(item.purchasePrice)}<span className="text-[10px] text-gray-400">/{item.unit}</span></div>
                          {item.salesUnit && item.salesUnit !== item.unit && (
                            <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                              ({formatINR(item.purchasePrice * getConversionFactor(item.salesUnit, item.unit, state.unitConversions))}/{item.salesUnit})
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-800 font-mono">
                          <div>{item.salePrice < 1 ? `₹${item.salePrice.toFixed(2)}` : formatINR(item.salePrice)}<span className="text-[10px] text-gray-400">/{item.unit}</span></div>
                          {item.salesUnit && item.salesUnit !== item.unit && (
                            <div className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md font-bold mt-1 inline-block border border-purple-100 shadow-2xs">
                              {formatINR(item.salePrice * getConversionFactor(item.salesUnit, item.unit, state.unitConversions))} / {item.salesUnit}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center font-extrabold text-sm font-mono">
                          {item.stockQuantity.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">{item.unit}</span>
                          {item.salesUnit && item.salesUnit !== item.unit && (
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              ({(item.stockQuantity * getConversionFactor(item.unit, item.salesUnit, state.unitConversions)).toFixed(2).replace(/\.00$/, "")} {item.salesUnit})
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isLowStock ? (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                              <AlertTriangle size={11} /> Reorder Low
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                              <CheckCircle size={11} /> Stock OK
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditClick(item)}
                              className="p-1.5 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-800 text-gray-600 border rounded cursor-pointer"
                              title="Edit Product"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {activeSubTab === "conversions" && (
        <div className="space-y-6">
          {/* Add Conversion Rule Form */}
          <form onSubmit={handleAddConversionRule} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 border-b pb-2">Create Master Unit Conversion Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">From Unit (e.g. kg, Box) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. kg"
                  value={newFromUnit}
                  onChange={(e) => setNewFromUnit(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">To Unit (e.g. g, Piece) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. g"
                  value={newToUnit}
                  onChange={(e) => setNewToUnit(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Conversion Factor *</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  required
                  placeholder="e.g. 1000"
                  value={newFactor}
                  onChange={(e) => setNewFactor(e.target.value !== "" ? parseFloat(e.target.value) : "")}
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-bold"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-gray-500 italic">
                Formula: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Quantity in To Unit = Quantity in From Unit × Factor</span>
              </p>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Save Conversion Rule
              </button>
            </div>
          </form>

          {/* Master Conversion Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900">Active Unit Conversion Table</h3>
              <span className="text-xs font-mono text-gray-400">Total Rules: {(state.unitConversions || []).length}</span>
            </div>

            {(!state.unitConversions || state.unitConversions.length === 0) ? (
              <p className="text-sm text-gray-500 py-12 text-center">No unit conversion rules defined yet.</p>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[300px] relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                      <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">From Unit</th>
                      <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">To Unit</th>
                      <th className="p-4 text-right bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Conversion Factor</th>
                      <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Rule Explanation</th>
                      <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                    {state.unitConversions.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50/40">
                        <td className="p-4 font-bold font-mono text-gray-900">{rule.fromUnit}</td>
                        <td className="p-4 font-bold font-mono text-emerald-800">{rule.toUnit}</td>
                        <td className="p-4 text-right font-bold font-mono">{rule.factor}</td>
                        <td className="p-4 text-gray-500 italic">
                          1 {rule.fromUnit} is equal to {rule.factor} {rule.toUnit}(s)
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteConversionRule(rule.id)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-700 text-gray-400 border border-gray-100 rounded cursor-pointer transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Unit Registration Modal */}
      {showInlineUnitModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden animate-scaleUp">
            {/* Emerald border top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600"></div>
            
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">
                  {inlineUnitMode === "edit" ? `Modify ${inlineUnitField === "purchase" ? "Purchase" : "Sales"} Unit` : `Register New ${inlineUnitField === "purchase" ? "Purchase" : "Sales"} Unit`}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInlineUnitModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveInlineUnit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Unit of Measure Name *</label>
                  <input
                    type="text"
                    required
                    value={inlineUnitValue}
                    onChange={(e) => setInlineUnitValue(e.target.value)}
                    placeholder="E.g., Bags, Box, kg, Liters"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInlineUnitModal(false)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Inline Category Registration Modal */}
      {showInlineCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden animate-scaleUp">
            {/* Emerald border top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600"></div>
            
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">
                  {inlineCategoryMode === "edit" ? "Modify Category Name" : "Register New Category"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInlineCategoryModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveInlineCategory} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={inlineCategoryValue}
                    onChange={(e) => setInlineCategoryValue(e.target.value)}
                    placeholder="E.g., Snacks, Beverages, Grains"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInlineCategoryModal(false)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}