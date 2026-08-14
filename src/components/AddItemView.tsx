import React, { useState } from "react";
import { ERPState, Item } from "../types";
import { formatINR, getConversionFactor } from "../utils";
import { 
  Plus, 
  Check, 
  Edit2, 
  X, 
  Sparkles, 
  PlusCircle, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Copy, 
  Trash2, 
  Scale, 
  ListOrdered,
  Settings2,
  Link2,
  Unlink
} from "lucide-react";

interface AddItemViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  setCurrentTab: (tab: string) => void;
}

export default function AddItemView({ state, onUpdateState, setCurrentTab }: AddItemViewProps) {
  // Navigation Sub Tab state
  const [activeSubTab, setActiveSubTab] = useState<"add-item" | "catalog" | "conversions" | "classifications-units">("catalog");
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Form states for creating/editing
  const [code, setCode] = useState(() => `DT-ITEM-00${state.items.length + 1}`);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Grains");
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [unit, setUnit] = useState("Bags");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [salesUnit, setSalesUnit] = useState("");
  const [minStockLevel, setMinStockLevel] = useState<number>(10);
  const [itemTaxType, setItemTaxType] = useState<"GST" | "NON_GST">("GST");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState<number>(18);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "code" | "stockQuantity" | "purchasePrice" | "salePrice">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Master Conversion Rule Form states
  const [newFromUnit, setNewFromUnit] = useState("");
  const [newToUnit, setNewToUnit] = useState("");
  const [newFactor, setNewFactor] = useState<number | "">("");
  const [editingConversionRuleId, setEditingConversionRuleId] = useState<string | null>(null);

  // States for Manage Linked Items Modal
  const [showLinkedItemsModal, setShowLinkedItemsModal] = useState(false);
  const [linkedItemsModalType, setLinkedItemsModalType] = useState<"category" | "unit">("category");
  const [linkedItemsModalTarget, setLinkedItemsModalTarget] = useState("");
  const [selectedItemToLink, setSelectedItemToLink] = useState("");
  const [linkedItemsSearch, setLinkedItemsSearch] = useState("");
  const [linkageCapacity, setLinkageCapacity] = useState<"unit" | "purchaseUnit" | "salesUnit">("unit");

  // Categories list
  const defaultCategories = ["Grains", "Groceries", "Edible Oils", "Spices"];
  const allCategories = state.customCategories && state.customCategories.length > 0
    ? state.customCategories
    : defaultCategories;

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

  // Unit States
  const defaultUnits = ["Bags", "Tins", "Pcs", "Kgs", "Liters", "g", "kg", "L", "ml", "Box", "Piece", "Dozen"];
  const allUnits = state.customUnits && state.customUnits.length > 0
    ? state.customUnits
    : defaultUnits;

  // States for inline unit registration/modification modal
  const [showInlineUnitModal, setShowInlineUnitModal] = useState(false);
  const [inlineUnitMode, setInlineUnitMode] = useState<"create" | "edit">("create");
  const [inlineUnitField, setInlineUnitField] = useState<"base" | "purchase" | "sales">("base");
  const [inlineUnitValue, setInlineUnitValue] = useState("");
  const [inlineOriginalUnitValue, setInlineOriginalUnitValue] = useState("");

  const handleAddUnitInline = (field: "base" | "purchase" | "sales") => {
    setInlineUnitField(field);
    setInlineUnitMode("create");
    setInlineUnitValue("");
    setShowInlineUnitModal(true);
  };

  const handleEditUnitInline = (field: "base" | "purchase" | "sales") => {
    const currentVal = field === "base" ? unit : (field === "purchase" ? purchaseUnit : salesUnit);
    if (!currentVal) return;
    setInlineUnitField(field);
    setInlineUnitMode("edit");
    setInlineUnitValue(currentVal);
    setInlineOriginalUnitValue(currentVal);
    setShowInlineUnitModal(true);
  };

  const handleDeleteUnitInline = (field: "base" | "purchase" | "sales") => {
    const currentVal = field === "base" ? unit : (field === "purchase" ? purchaseUnit : salesUnit);
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

      if (field === "base") {
        setUnit(fallback);
      } else if (field === "purchase") {
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
        onUpdateState({
          ...state,
          customUnits: [...allUnits, trimmed],
        });
      }
      if (inlineUnitField === "base") setUnit(trimmed);
      else if (inlineUnitField === "purchase") setPurchaseUnit(trimmed);
      else setSalesUnit(trimmed);
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

      if (unit === original) setUnit(trimmed);
      if (purchaseUnit === original) setPurchaseUnit(trimmed);
      if (salesUnit === original) setSalesUnit(trimmed);

      const updatedItems = state.items.map((item) => {
        const newItem = { ...item };
        if (newItem.unit === original) newItem.unit = trimmed;
        if (newItem.purchaseUnit === original) newItem.purchaseUnit = trimmed;
        if (newItem.salesUnit === original) newItem.salesUnit = trimmed;
        return newItem;
      });

      const updatedConversions = (state.unitConversions || []).map((c) => {
        const next = { ...c };
        if (next.fromUnit === original) next.fromUnit = trimmed;
        if (next.toUnit === original) next.toUnit = trimmed;
        return next;
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

  // SKU code generator helper
  const generateSkuCode = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const safePrefix = name ? name.trim().slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "X") : "ITEM";
    setCode(`DT-${safePrefix}-${randomSuffix}`);
  };

  // Submit Handler for Creating or Updating product information
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !name.trim()) {
      alert("SKU Code and Product Name are required.");
      return;
    }

    // Check code duplication (excluding the item currently being edited)
    const duplicate = state.items.find(
      (item) => 
        item.code.trim().toUpperCase() === code.trim().toUpperCase() && 
        (!editingItem || item.id !== editingItem.id)
    );
    if (duplicate) {
      alert(`SKU Code "${code}" is already in use by product "${duplicate.name}". Please choose a unique SKU Code.`);
      return;
    }

    if (itemTaxType === "GST" && !hsnCode) {
      alert("HSN Code is required for GST Items.");
      return;
    }

    let updatedItems = [...state.items];

    if (editingItem) {
      // Edit mode
      updatedItems = updatedItems.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            code: code.trim(),
            name: name.trim(),
            description: description.trim(),
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
      setSuccessMessage(`Successfully updated product "${name}"!`);
    } else {
      // Create mode
      const newItem: Item = {
        id: "i-" + Math.random().toString(36).substring(2, 9),
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
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
      setSuccessMessage(`Successfully added "${newItem.name}" to the catalog!`);
    }

    onUpdateState({
      ...state,
      items: updatedItems,
    });

    // Reset Form states
    setEditingItem(null);
    setName("");
    setDescription("");
    setPurchasePrice(0);
    setSalePrice(0);
    setStockQuantity(0);
    setHsnCode("");
    setMinStockLevel(10);
    setCode(`DT-ITEM-00${updatedItems.length + 1}`);

    // Switch view to product catalog list
    setActiveSubTab("catalog");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Edit click from catalog table
  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
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

    setActiveSubTab("add-item");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Duplicate click from catalog table
  const handleDuplicateClick = (item: Item) => {
    setEditingItem(null);
    
    let newCode = item.code + "-COPY";
    let attempts = 1;
    while (state.items.some((i) => i.code === newCode)) {
      newCode = `${item.code}-COPY${attempts}`;
      attempts++;
    }

    setCode(newCode);
    setName(`${item.name} (Copy)`);
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

    setActiveSubTab("add-item");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete click from catalog table
  const handleDeleteClick = (itemId: string, itemName: string) => {
    if (confirm(`Are you sure you want to delete product "${itemName}"? This will remove it from the catalog.`)) {
      onUpdateState({
        ...state,
        items: state.items.filter((item) => item.id !== itemId),
      });
      setSuccessMessage(`Successfully deleted product "${itemName}"`);
    }
  };

  // Unit edit click handlers for conversions
  const handleEditConversionRuleClick = (rule: { id: string; fromUnit: string; toUnit: string; factor: number }) => {
    setEditingConversionRuleId(rule.id);
    setNewFromUnit(rule.fromUnit);
    setNewToUnit(rule.toUnit);
    setNewFactor(rule.factor);
  };

  const handleCancelEditConversionRule = () => {
    setEditingConversionRuleId(null);
    setNewFromUnit("");
    setNewToUnit("");
    setNewFactor("");
  };

  // Unit conversion rule form submit (both Add and Edit)
  const handleAddConversionRule = (e: React.FormEvent) => {
    e.preventDefault();
    const from = newFromUnit.trim();
    const to = newToUnit.trim();
    const fact = Number(newFactor);

    if (!from || !to || !fact || isNaN(fact) || fact <= 0) {
      alert("Please enter valid From Unit, To Unit, and a positive factor.");
      return;
    }

    const conversions = state.unitConversions || [];

    if (editingConversionRuleId) {
      // Edit Mode
      const exists = conversions.some(
        (c) => c.id !== editingConversionRuleId && c.fromUnit.toLowerCase() === from.toLowerCase() && c.toUnit.toLowerCase() === to.toLowerCase()
      );
      if (exists) {
        alert(`Another conversion rule from ${from} to ${to} already exists.`);
        return;
      }

      const updatedConversions = conversions.map((c) => {
        if (c.id === editingConversionRuleId) {
          return {
            ...c,
            fromUnit: from,
            toUnit: to,
            factor: fact,
          };
        }
        return c;
      });

      onUpdateState({
        ...state,
        unitConversions: updatedConversions,
      });

      setEditingConversionRuleId(null);
      setNewFromUnit("");
      setNewToUnit("");
      setNewFactor("");
      setSuccessMessage(`Successfully updated conversion rule: 1 ${from} = ${fact} ${to}(s)`);
    } else {
      // Add Mode
      const exists = conversions.some(
        (c) => c.fromUnit.toLowerCase() === from.toLowerCase() && c.toUnit.toLowerCase() === to.toLowerCase()
      );
      if (exists) {
        alert(`A conversion rule from ${from} to ${to} already exists.`);
        return;
      }

      const newRule = {
        id: "uc-" + Math.random().toString(36).substring(2, 9),
        fromUnit: from,
        toUnit: to,
        factor: fact,
      };

      onUpdateState({
        ...state,
        unitConversions: [...conversions, newRule],
      });

      setNewFromUnit("");
      setNewToUnit("");
      setNewFactor("");
      setSuccessMessage(`Successfully added conversion rule: 1 ${from} = ${fact} ${to}(s)`);
    }
  };

  // Delete conversion rule
  const handleDeleteConversionRule = (id: string) => {
    if (confirm("Are you sure you want to delete this conversion rule?")) {
      const conversions = state.unitConversions || [];
      onUpdateState({
        ...state,
        unitConversions: conversions.filter((c) => c.id !== id),
      });
      if (editingConversionRuleId === id) {
        setEditingConversionRuleId(null);
        setNewFromUnit("");
        setNewToUnit("");
        setNewFactor("");
      }
    }
  };

  // Filter products by search term and category, with multi-option sorting
  const filteredItems = (state.items || [])
    .filter((item) => {
      if (!item) return false;
      const nameStr = String(item.name || "").toLowerCase();
      const codeStr = String(item.code || "").toLowerCase();
      const categoryStr = String(item.category || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = nameStr.includes(search) || codeStr.includes(search) || categoryStr.includes(search);
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = (a.name || "").localeCompare(b.name || "");
      } else if (sortBy === "code") {
        comparison = (a.code || "").localeCompare(b.code || "");
      } else if (sortBy === "stockQuantity") {
        comparison = a.stockQuantity - b.stockQuantity;
      } else if (sortBy === "purchasePrice") {
        comparison = a.purchasePrice - b.purchasePrice;
      } else if (sortBy === "salePrice") {
        comparison = a.salePrice - b.salePrice;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      
      {/* Header section with Sub-tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <PlusCircle className="text-[#002f1d]" size={26} />
            Item Catalog & Master Configurations
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Add and manage product SKUs, view catalog list, and define unit conversions.
          </p>
        </div>

        {/* Sub-tabs switcher */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => {
                setActiveSubTab("catalog");
                setEditingItem(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "catalog"
                  ? "bg-white text-[#002f1d] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ListOrdered size={13} /> Product Catalog
            </button>
            <button
              onClick={() => {
                setActiveSubTab("add-item");
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "add-item"
                  ? "bg-white text-[#002f1d] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Plus size={13} /> {editingItem ? "Edit Product SKU" : "Add Product SKU"}
            </button>
            <button
              onClick={() => {
                setActiveSubTab("classifications-units");
                setEditingItem(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "classifications-units"
                  ? "bg-white text-[#002f1d] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Settings2 size={13} /> Classifications & Units
            </button>
            <button
              onClick={() => {
                setActiveSubTab("conversions");
                setEditingItem(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "conversions"
                  ? "bg-white text-[#002f1d] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Scale size={13} /> Conversions
            </button>
          </div>

          <button
            onClick={() => setCurrentTab("stock-inventory")}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            View Stock Inventory
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
              <Check size={14} />
            </div>
            <div>
              <p className="font-bold text-sm">{successMessage}</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Configurations are dynamically propagated to your inventory registers and invoice generator.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="p-1 hover:bg-emerald-100 text-emerald-800 rounded-lg cursor-pointer animate-pulse"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}

      {/* 1. Add/Edit Product Item Form Tab */}
      {activeSubTab === "add-item" && (
        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6 animate-fade-in">
          
          {/* Section: Product Identification */}
          <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2 border-slate-200/80">
              <Sparkles size={13} className="text-[#002f1d]" />
              {editingItem ? `Modify Product Master Information` : `Register Product Core Details`}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase">SKU Code *</label>
                  {!editingItem && (
                    <button
                      type="button"
                      onClick={generateSkuCode}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer hover:underline flex items-center gap-0.5"
                    >
                      Auto-Generate
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={!!editingItem}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="E.g., DT-RICE-101"
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:ring-1 focus:ring-[#002f1d]/30 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g., Premium Basmati Rice"
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:ring-1 focus:ring-[#002f1d]/30 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Description / Specifications</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product attributes, packaging standard (e.g., 50kg Jute Bag), brand origin, export grade..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:ring-1 focus:ring-[#002f1d]/30 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Classification & Unit Master Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4 border border-slate-100 p-5 rounded-xl bg-white shadow-3xs">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider border-b pb-2 mb-3 flex items-center justify-between border-slate-200/80">
                <span>Classification & UOM Units</span>
              </h4>

              {/* Category selector */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase">Category *</label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={handleAddCategoryInline}
                      className="text-[#002f1d] hover:text-emerald-800 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      <Plus size={10} /> Add
                    </button>
                    {category && (
                      <>
                        <button
                          type="button"
                          onClick={handleEditCategoryInline}
                          className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                        >
                          <Edit2 size={10} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteCategoryInline}
                          className="text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
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
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-[#002f1d] focus:outline-none bg-white cursor-pointer"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Base Stock Unit */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase">Base Stock Unit *</label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleAddUnitInline("base")}
                      className="text-[#002f1d] hover:text-emerald-800 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      <Plus size={10} /> Add
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditUnitInline("base")}
                      className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      <Edit2 size={10} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUnitInline("base")}
                      className="text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                  </div>
                </div>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-[#002f1d] focus:outline-none bg-white cursor-pointer"
                >
                  {allUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Transactional alternate units */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-tight">Purchase Unit</label>
                    <div className="flex items-center gap-1 text-[9px]">
                      <button
                        type="button"
                        onClick={() => handleAddUnitInline("purchase")}
                        className="text-[#002f1d] hover:text-emerald-800 font-bold hover:underline cursor-pointer"
                      >
                        + Register
                      </button>
                      {purchaseUnit && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditUnitInline("purchase")}
                            className="text-amber-600 hover:text-amber-700 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnitInline("purchase")}
                            className="text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <select
                    value={purchaseUnit}
                    onChange={(e) => setPurchaseUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-[#002f1d] focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="">Same as Base ({unit})</option>
                    {allUnits.filter(u => u !== unit).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-tight">Sales Unit</label>
                    <div className="flex items-center gap-1 text-[9px]">
                      <button
                        type="button"
                        onClick={() => handleAddUnitInline("sales")}
                        className="text-[#002f1d] hover:text-emerald-800 font-bold hover:underline cursor-pointer"
                      >
                        + Register
                      </button>
                      {salesUnit && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditUnitInline("sales")}
                            className="text-amber-600 hover:text-amber-700 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnitInline("sales")}
                            className="text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <select
                    value={salesUnit}
                    onChange={(e) => setSalesUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-[#002f1d] focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="">Same as Base ({unit})</option>
                    {allUnits.filter(u => u !== unit).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Threshold limits */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Minimum Stock Warning Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:outline-none font-mono"
                />
              </div>

            </div>

            {/* Price & Taxation Section */}
            <div className="space-y-4 border border-slate-100 p-5 rounded-xl bg-white shadow-3xs flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider border-b pb-2 mb-3 border-slate-200/80">
                  Pricing, Taxes & Starting Balance
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Purchase Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:outline-none font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Sale Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={salePrice}
                      onChange={(e) => setSalePrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:outline-none font-mono font-semibold"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Initial Physical Stock Quantity {editingItem && "(Manual Correction)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:border-[#002f1d] focus:outline-none font-mono text-slate-800 font-bold"
                    placeholder="Starting stock level"
                  />
                </div>

                {/* Tax types & properties */}
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 tracking-wider">Item Tax Liability Type</label>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="itemTaxType"
                          checked={itemTaxType === "GST"}
                          onChange={() => setItemTaxType("GST")}
                          className="text-[#002f1d] focus:ring-0 cursor-pointer"
                        />
                        GST Taxable
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="itemTaxType"
                          checked={itemTaxType === "NON_GST"}
                          onChange={() => setItemTaxType("NON_GST")}
                          className="text-[#002f1d] focus:ring-0 cursor-pointer"
                        />
                        Exempted / Non-GST
                      </label>
                    </div>
                  </div>

                  {itemTaxType === "GST" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">HSN Code *</label>
                        <input
                          type="text"
                          required
                          value={hsnCode}
                          onChange={(e) => setHsnCode(e.target.value)}
                          placeholder="E.g., 1006"
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-[#002f1d] focus:outline-none font-mono bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">GST Tax Rate (%)</label>
                        <select
                          value={gstRate}
                          onChange={(e) => setGstRate(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-[#002f1d] focus:outline-none bg-white cursor-pointer"
                        >
                          <option value="0">0% (Nil Rated)</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18% (Standard)</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t mt-4 border-slate-100">
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setName("");
                      setDescription("");
                      setPurchasePrice(0);
                      setSalePrice(0);
                      setStockQuantity(0);
                      setHsnCode("");
                      setMinStockLevel(10);
                      setCode(`DT-ITEM-00${state.items.length + 1}`);
                      setActiveSubTab("catalog");
                    }}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer border border-slate-200"
                  >
                    Discard Changes
                  </button>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer transition-colors"
                >
                  {editingItem ? "Commit Updates" : "Register Product Master"}
                </button>
              </div>

            </div>
          </div>
        </form>
      )}

      {/* 2. Product Catalog Directory View Tab */}
      {activeSubTab === "catalog" && (
        <div className="space-y-4 animate-fade-in">
          {/* A. Dashboard summary strip inside Catalog view */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-3xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Total SKUs</p>
                <p className="text-xl font-black text-slate-900 mt-1 font-mono">{(state.items || []).length}</p>
              </div>
              <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
                <ListOrdered size={16} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-3xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Low Stock Warning</p>
                <p className={`text-xl font-black mt-1 font-mono ${(state.items || []).filter(item => item.stockQuantity <= item.minStockLevel).length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {(state.items || []).filter(item => item.stockQuantity <= item.minStockLevel).length}
                </p>
              </div>
              <div className={`p-2.5 rounded-lg ${(state.items || []).filter(item => item.stockQuantity <= item.minStockLevel).length > 0 ? "bg-rose-50 text-rose-600 animate-pulse" : "bg-emerald-50 text-emerald-600"}`}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-3xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Taxable GST SKUs</p>
                <p className="text-xl font-black text-slate-900 mt-1 font-mono">{(state.items || []).filter(item => item.item_tax_type !== 'NON_GST').length}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-3xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Base Categories</p>
                <p className="text-xl font-black text-slate-900 mt-1 font-mono">{allCategories.length}</p>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
                <Settings2 size={16} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Beautiful Search, Filter & Sort Controls Panel */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-3">
              <div className="relative w-full lg:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search SKU name, code, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#002f1d] font-semibold shadow-3xs transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                {/* Category Filter */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-3xs">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Category</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-transparent text-slate-700 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    {allCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Sort Option Dropdown */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-3xs">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Sort By</span>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split("-") as [any, any];
                      setSortBy(field);
                      setSortOrder(order);
                    }}
                    className="bg-transparent text-slate-700 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="code-asc">SKU Code (Asc)</option>
                    <option value="code-desc">SKU Code (Desc)</option>
                    <option value="stockQuantity-asc">Stock (Low to High)</option>
                    <option value="stockQuantity-desc">Stock (High to Low)</option>
                    <option value="purchasePrice-desc">Cost (High to Low)</option>
                    <option value="salePrice-desc">Selling Price (High to Low)</option>
                  </select>
                </div>

                {/* Quick Register Product Button */}
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setActiveSubTab("add-item");
                  }}
                  className="px-3.5 py-1.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> Add SKU
                </button>
              </div>
            </div>

            {/* Catalog items table */}
            {(state.items || []).length === 0 ? (
              <div className="py-16 text-center max-w-md mx-auto px-4">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <PlusCircle className="text-slate-400" size={20} />
                </div>
                <p className="text-sm text-slate-800 font-bold">No products registered in the master catalog yet</p>
                <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                  Add your product SKUs to begin tracking purchase orders, sales invoices, inventory levels, and stock balances.
                </p>
                <button
                  onClick={() => {
                    setActiveSubTab("add-item");
                  }}
                  className="px-4 py-2 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  Register Your First Product SKU
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-500 font-bold">No catalog items match your filter criteria.</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("All");
                  }}
                  className="mt-3 text-xs text-[#002f1d] hover:underline font-extrabold cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold tracking-wider uppercase text-[10px]">
                    <th className="p-4">SKU Code</th>
                    <th className="p-4">Product Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Purchase Rate</th>
                    <th className="p-4 text-right">Selling Price</th>
                    <th className="p-4 text-center">In-Stock Balance</th>
                    <th className="p-4 text-center">Stock Warning</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {filteredItems.map((item) => {
                    const isLowStock = item.stockQuantity <= item.minStockLevel;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/40 transition-all">
                        <td className="p-4 font-extrabold font-mono text-slate-900 text-xs">{item.code}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-900 text-xs">{item.name}</p>
                          <p className="text-[10px] text-slate-400 max-w-sm truncate mt-0.5">{item.description || "No description provided."}</p>
                          
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">Base UOM: {item.unit}</span>
                            {item.purchaseUnit && <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Purchase: {item.purchaseUnit}</span>}
                            {item.salesUnit && <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Sales: {item.salesUnit}</span>}
                          </div>
                          
                          <p className="text-[9px] font-mono mt-1 text-slate-500 font-bold">
                            {item.item_tax_type === "NON_GST" ? (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50">Exempted / 0% Tax</span>
                            ) : (
                              <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">HSN: {item.hsnCode || "N/A"} · Rate: {item.gstRate !== undefined ? item.gstRate : 18}%</span>
                            )}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono">
                          <div className="font-bold text-slate-800">{formatINR(item.purchasePrice)}<span className="text-[9px] text-slate-400 font-normal">/{item.unit}</span></div>
                          {item.salesUnit && item.salesUnit !== item.unit && (
                            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                              ({formatINR(item.purchasePrice * getConversionFactor(item.salesUnit, item.unit, state.unitConversions))}/{item.salesUnit})
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900 font-mono">
                          <div>{formatINR(item.salePrice)}<span className="text-[9px] text-slate-400 font-normal">/{item.unit}</span></div>
                          {item.salesUnit && item.salesUnit !== item.unit && (
                            <div className="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold mt-1 inline-block border border-indigo-100/50">
                              {formatINR(item.salePrice * getConversionFactor(item.salesUnit, item.unit, state.unitConversions))} / {item.salesUnit}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center font-extrabold text-xs font-mono text-slate-800">
                          {item.stockQuantity.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">{item.unit}</span>
                          {item.salesUnit && item.salesUnit !== item.unit && (
                            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                              ({(item.stockQuantity * getConversionFactor(item.unit, item.salesUnit, state.unitConversions)).toFixed(2).replace(/\.00$/, "")} {item.salesUnit})
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isLowStock ? (
                            <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5">
                              <AlertTriangle size={10} /> Reorder warning
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5">
                              <CheckCircle size={10} /> Level Healthy
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleDuplicateClick(item)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-lg cursor-pointer transition-colors"
                              title="Duplicate Item Core Data"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              onClick={() => handleEditClick(item)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                              title="Modify Product Specifications"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item.id, item.name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-lg cursor-pointer transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 size={12} />
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
      </div>
    )}

      {/* 3. Master Unit Conversions Tab */}
      {activeSubTab === "conversions" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Create / Edit Rule Form */}
          <form onSubmit={handleAddConversionRule} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b pb-2.5 flex items-center justify-between border-slate-100">
              <span className="flex items-center gap-1.5">
                <Scale className="text-[#002f1d]" size={16} /> 
                {editingConversionRuleId ? "Edit Master Unit Conversion Rule" : "Create Master Unit Conversion Rules"}
              </span>
              {editingConversionRuleId && (
                <button
                  type="button"
                  onClick={handleCancelEditConversionRule}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                >
                  <X size={12} /> Cancel Edit
                </button>
              )}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">From Unit (Standard/Bulk Pack) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Box, Bag, Metric Ton"
                  value={newFromUnit}
                  onChange={(e) => setNewFromUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-[#002f1d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">To Unit (Smaller Fraction/Base Unit) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Piece, Kgs, Grams"
                  value={newToUnit}
                  onChange={(e) => setNewToUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-[#002f1d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Conversion Factor Rate *</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  required
                  placeholder="e.g., 25"
                  value={newFactor}
                  onChange={(e) => setNewFactor(e.target.value !== "" ? parseFloat(e.target.value) : "")}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-[#002f1d] focus:outline-none font-bold font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 gap-2">
              <p className="text-[11px] text-slate-500 italic bg-slate-50 px-2.5 py-1.5 rounded-lg border">
                Mathematical Rule: <span className="font-mono bg-white font-bold px-1.5 py-0.5 rounded border">Quantity in To Unit = Quantity in From Unit × Factor</span>
              </p>
              <div className="flex gap-2 self-end sm:self-auto">
                {editingConversionRuleId && (
                  <button
                    type="button"
                    onClick={handleCancelEditConversionRule}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-extrabold cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-lg text-xs font-extrabold shadow-sm cursor-pointer transition-all"
                >
                  {editingConversionRuleId ? "Update Conversion Factor" : "Register Conversion Factor"}
                </button>
              </div>
            </div>
          </form>

          {/* Conversion Rules directory table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Mathematical Conversion Matrix</h3>
              <span className="text-xs font-mono font-bold text-slate-400">Total Rules: {(state.unitConversions || []).length}</span>
            </div>

            {(!state.unitConversions || state.unitConversions.length === 0) ? (
              <p className="text-sm text-slate-400 py-12 text-center">No unit conversion factors defined. Standard 1:1 ratio is assumed by default.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="p-4">From Unit</th>
                      <th className="p-4">To Unit</th>
                      <th className="p-4 text-right">Conversion Factor</th>
                      <th className="p-4">Logical Interpretation</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 font-medium font-mono text-[11px]">
                    {state.unitConversions.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-extrabold text-slate-900">{rule.fromUnit}</td>
                        <td className="p-4 font-extrabold text-[#002f1d]">{rule.toUnit}</td>
                        <td className="p-4 text-right font-extrabold text-indigo-700">{rule.factor}</td>
                        <td className="p-4 text-slate-500 italic font-sans font-medium text-xs">
                          Each individual <span className="font-bold text-slate-800">{rule.fromUnit}</span> contains exactly <span className="font-bold text-slate-800">{rule.factor}</span> {rule.toUnit}(s).
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditConversionRuleClick(rule)}
                              className={`p-1.5 border rounded-lg cursor-pointer transition-colors ${
                                editingConversionRuleId === rule.id
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : "hover:bg-amber-50 hover:text-amber-700 text-slate-400 border-slate-100"
                              }`}
                              title="Edit Conversion Rule"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteConversionRule(rule.id)}
                              className="p-1.5 hover:bg-rose-50 hover:text-rose-700 text-slate-400 border border-slate-100 rounded-lg cursor-pointer transition-colors"
                              title="Delete Conversion Rule"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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

      {/* 4. Classifications & Units Management Tab */}
      {activeSubTab === "classifications-units" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          
          {/* A. CLASSIFICATION / CATEGORIES CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-3xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 size={16} className="text-[#002f1d]" />
                  Product Classifications
                </h3>
                <p className="text-[11px] text-slate-500">
                  Organize your inventory with custom product categories.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCategoryInline}
                className="px-3 py-1.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} /> Add New
              </button>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase text-[10px]">
                    <th className="p-3">Category Name</th>
                    <th className="p-3 text-center">Source</th>
                    <th className="p-3 text-center">Linked SKUs</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allCategories.map((cat, idx) => {
                    const isDefault = defaultCategories.includes(cat);
                    const linkedItemsCount = state.items.filter(item => item.category === cat).length;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="p-3">
                          <span className="font-bold text-slate-800 text-xs">{cat}</span>
                        </td>
                        <td className="p-3 text-center">
                          {isDefault ? (
                            <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded font-semibold">
                              Default
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setLinkedItemsModalType("category");
                              setLinkedItemsModalTarget(cat);
                              setSelectedItemToLink("");
                              setLinkedItemsSearch("");
                              setShowLinkedItemsModal(true);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-3xs"
                            title="Click to view and manage linked items"
                          >
                            <Link2 size={11} className="text-amber-600" />
                            {linkedItemsCount} Item(s)
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setInlineCategoryMode("edit");
                                setInlineCategoryValue(cat);
                                setInlineOriginalCategoryValue(cat);
                                setShowInlineCategoryModal(true);
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-[#002f1d] hover:text-white text-slate-600 rounded border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-all"
                            >
                              <Edit2 size={9} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete category "${cat}"? This will also update any items currently mapped to this category.`)) {
                                  const fallback = allCategories.find((c) => c !== cat) || "Grains";
                                  const updatedItems = state.items.map((item) => {
                                    if (item.category === cat) {
                                      return { ...item, category: fallback };
                                    }
                                    return item;
                                  });
                                  onUpdateState({
                                    ...state,
                                    customCategories: allCategories.filter((c) => c !== cat),
                                    items: updatedItems,
                                  });
                                  if (category === cat) {
                                    setCategory(fallback);
                                  }
                                }
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-all"
                            >
                              <Trash2 size={9} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* B. UNITS OF MEASURE (UOM) CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-3xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale size={16} className="text-[#002f1d]" />
                  Units of Measure (UOM)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Register units and packaging metrics used across your ERP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAddUnitInline("base")}
                className="px-3 py-1.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} /> Add New
              </button>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase text-[10px]">
                    <th className="p-3">Unit Name</th>
                    <th className="p-3 text-center">Source</th>
                    <th className="p-3 text-center">Active Usage</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUnits.map((u, idx) => {
                    const isDefault = defaultUnits.includes(u);
                    const usageCount = state.items.filter(item => item.unit === u || item.purchaseUnit === u || item.salesUnit === u).length;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="p-3">
                          <span className="font-bold text-slate-800 text-xs">{u}</span>
                        </td>
                        <td className="p-3 text-center">
                          {isDefault ? (
                            <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded font-semibold">
                              Default
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setLinkedItemsModalType("unit");
                              setLinkedItemsModalTarget(u);
                              setSelectedItemToLink("");
                              setLinkedItemsSearch("");
                              setShowLinkedItemsModal(true);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-3xs"
                            title="Click to view and manage linked items"
                          >
                            <Link2 size={11} className="text-amber-600" />
                            {usageCount} Item(s)
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setInlineUnitField("base");
                                setInlineUnitMode("edit");
                                setInlineUnitValue(u);
                                setInlineOriginalUnitValue(u);
                                setShowInlineUnitModal(true);
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-[#002f1d] hover:text-white text-slate-600 rounded border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-all"
                            >
                              <Edit2 size={9} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete unit "${u}"? This will also remove it from any items or unit conversion rules using it.`)) {
                                  const fallback = allUnits.find(unitVal => unitVal !== u) || "Bags";
                                  const updatedItems = state.items.map((item) => {
                                    const newItem = { ...item };
                                    if (newItem.unit === u) newItem.unit = fallback;
                                    if (newItem.purchaseUnit === u) newItem.purchaseUnit = undefined;
                                    if (newItem.salesUnit === u) newItem.salesUnit = undefined;
                                    return newItem;
                                  });

                                  const updatedConversions = (state.unitConversions || []).filter(
                                    (c) => c.fromUnit !== u && c.toUnit !== u
                                  );

                                  onUpdateState({
                                    ...state,
                                    customUnits: allUnits.filter((itemU) => itemU !== u),
                                    items: updatedItems,
                                    unitConversions: updatedConversions,
                                  });

                                  if (unit === u) setUnit(fallback);
                                  if (purchaseUnit === u) setPurchaseUnit("");
                                  if (salesUnit === u) setSalesUnit("");
                                }
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-all"
                            >
                              <Trash2 size={9} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Inline Category Creation/Edit Modal */}
      {showInlineCategoryModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {inlineCategoryMode === "create" ? "Add New Category" : "Edit Category Name"}
              </h3>
              <button onClick={() => setShowInlineCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveInlineCategory} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={inlineCategoryValue}
                  onChange={(e) => setInlineCategoryValue(e.target.value)}
                  placeholder="E.g., Pulses, Packaging, etc."
                  className="w-full rounded-lg border p-2.5 text-sm focus:border-[#002f1d] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInlineCategoryModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Unit Creation/Edit Modal */}
      {showInlineUnitModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {inlineUnitMode === "create" ? "Add Custom Unit" : "Edit Unit Name"}
              </h3>
              <button onClick={() => setShowInlineUnitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveInlineUnit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit of Measure (UOM)</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={inlineUnitValue}
                  onChange={(e) => setInlineUnitValue(e.target.value)}
                  placeholder="E.g., Carton, Bundle, Metric Ton"
                  className="w-full rounded-lg border p-2.5 text-sm focus:border-[#002f1d] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInlineUnitModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Linked Items Modal */}
      {showLinkedItemsModal && (() => {
        // Find items linked to target
        const linkedItems = state.items.filter(item => {
          if (linkedItemsModalType === "category") {
            return item.category === linkedItemsModalTarget;
          } else {
            return (
              item.unit === linkedItemsModalTarget ||
              item.purchaseUnit === linkedItemsModalTarget ||
              item.salesUnit === linkedItemsModalTarget
            );
          }
        });

        // Filter by search text
        const searchedLinkedItems = linkedItems.filter(item => {
          const q = linkedItemsSearch.toLowerCase().trim();
          if (!q) return true;
          return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
        });

        // Find items that can be linked
        const eligibleItemsToLink = state.items.filter(item => {
          if (linkedItemsModalType === "category") {
            return item.category !== linkedItemsModalTarget;
          } else {
            // For unit, an item is eligible if it's not already linked in the selected capacity
            if (linkageCapacity === "unit") {
              return item.unit !== linkedItemsModalTarget;
            } else if (linkageCapacity === "purchaseUnit") {
              return item.purchaseUnit !== linkedItemsModalTarget;
            } else {
              return item.salesUnit !== linkedItemsModalTarget;
            }
          }
        });

        const handleRemoveLink = (item: Item, fieldType?: "unit" | "purchaseUnit" | "salesUnit") => {
          if (linkedItemsModalType === "category") {
            const fallback = allCategories.find((c) => c !== linkedItemsModalTarget) || "Grains";
            if (confirm(`Remove item "${item.name}" from category "${linkedItemsModalTarget}"?\nIts category will revert to "${fallback}".`)) {
              const updatedItems = state.items.map(it => {
                if (it.id === item.id) {
                  return { ...it, category: fallback };
                }
                return it;
              });
              onUpdateState({ ...state, items: updatedItems });
            }
          } else {
            const actualField = fieldType || "unit";
            const label = actualField === "unit" ? "Base Unit" : actualField === "purchaseUnit" ? "Purchase Unit" : "Sales Unit";
            
            if (actualField === "unit") {
              const fallback = allUnits.find(unitVal => unitVal !== linkedItemsModalTarget) || "Bags";
              if (confirm(`Remove unit "${linkedItemsModalTarget}" as Base Unit for item "${item.name}"?\nIts Base Unit will revert to "${fallback}".`)) {
                const updatedItems = state.items.map(it => {
                  if (it.id === item.id) {
                    return { ...it, unit: fallback };
                  }
                  return it;
                });
                onUpdateState({ ...state, items: updatedItems });
              }
            } else {
              if (confirm(`Remove unit "${linkedItemsModalTarget}" as ${label} for item "${item.name}"?`)) {
                const updatedItems = state.items.map(it => {
                  if (it.id === item.id) {
                    return { ...it, [actualField]: undefined };
                  }
                  return it;
                });
                onUpdateState({ ...state, items: updatedItems });
              }
            }
          }
        };

        const handleAddLink = () => {
          if (!selectedItemToLink) return;
          const targetItem = state.items.find(it => it.id === selectedItemToLink);
          if (!targetItem) return;

          if (linkedItemsModalType === "category") {
            const updatedItems = state.items.map(it => {
              if (it.id === selectedItemToLink) {
                return { ...it, category: linkedItemsModalTarget };
              }
              return it;
            });
            onUpdateState({ ...state, items: updatedItems });
            setSelectedItemToLink("");
          } else {
            const updatedItems = state.items.map(it => {
              if (it.id === selectedItemToLink) {
                return { ...it, [linkageCapacity]: linkedItemsModalTarget };
              }
              return it;
            });
            onUpdateState({ ...state, items: updatedItems });
            setSelectedItemToLink("");
          }
        };

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <Link2 size={18} className="text-[#002f1d]" />
                    Manage Linked Items
                  </h3>
                  <p className="text-xs text-slate-500">
                    Currently managing links for {linkedItemsModalType === "category" ? "Category" : "Unit"}:{" "}
                    <span className="font-extrabold text-[#002f1d] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs">
                      {linkedItemsModalTarget}
                    </span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowLinkedItemsModal(false)} 
                  className="p-1 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Add New Link Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                  <PlusCircle size={13} className="text-[#002f1d]" />
                  Link an Item to this {linkedItemsModalType === "category" ? "Category" : "Unit"}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Item selection */}
                  <div className={linkedItemsModalType === "unit" ? "col-span-12 md:col-span-5" : "col-span-12 md:col-span-9"}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Item</label>
                    <select
                      value={selectedItemToLink}
                      onChange={(e) => setSelectedItemToLink(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-[#002f1d] focus:outline-none"
                    >
                      <option value="">-- Choose an item --</option>
                      {eligibleItemsToLink.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit capacity selector (Only if Unit) */}
                  {linkedItemsModalType === "unit" && (
                    <div className="col-span-12 md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Link Capacity</label>
                      <select
                        value={linkageCapacity}
                        onChange={(e) => setLinkageCapacity(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-[#002f1d] focus:outline-none"
                      >
                        <option value="unit">Base Unit</option>
                        <option value="purchaseUnit">Purchase Unit</option>
                        <option value="salesUnit">Sales Unit</option>
                      </select>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="col-span-12 md:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!selectedItemToLink}
                      className="w-full py-2 bg-[#002f1d] hover:bg-[#00472c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Link Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Linked Items List Section */}
              <div className="flex-1 flex flex-col min-h-0 text-left">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <ListOrdered size={13} className="text-[#002f1d]" />
                    Linked SKUs ({searchedLinkedItems.length})
                  </h4>

                  {/* Inline Search Bar */}
                  <div className="relative w-48">
                    <Search size={11} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by name/code..."
                      value={linkedItemsSearch}
                      onChange={(e) => setLinkedItemsSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 py-1.5 text-[11px] focus:border-[#002f1d] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Table list */}
                <div className="flex-1 overflow-y-auto border border-slate-150 rounded-xl">
                  {searchedLinkedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-1">
                      <Search size={20} className="stroke-1" />
                      <p className="text-xs">No linked items found matching filters.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase text-[9px] sticky top-0">
                          <th className="p-2.5">SKU Code</th>
                          <th className="p-2.5">Item Name</th>
                          {linkedItemsModalType === "unit" && <th className="p-2.5 text-center">Linked as</th>}
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {searchedLinkedItems.map(item => {
                          // Find how it is linked if unit
                          const links: Array<"unit" | "purchaseUnit" | "salesUnit"> = [];
                          if (linkedItemsModalType === "unit") {
                            if (item.unit === linkedItemsModalTarget) links.push("unit");
                            if (item.purchaseUnit === linkedItemsModalTarget) links.push("purchaseUnit");
                            if (item.salesUnit === linkedItemsModalTarget) links.push("salesUnit");
                          }

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/40">
                              <td className="p-2.5 font-mono text-[11px] font-bold text-slate-600">
                                {item.code}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 text-xs">
                                {item.name}
                              </td>
                              {linkedItemsModalType === "unit" && (
                                <td className="p-2.5 text-center space-y-1">
                                  {links.map(lk => {
                                    const lkName = lk === "unit" ? "Base Unit" : lk === "purchaseUnit" ? "Purchase Unit" : "Sales Unit";
                                    const lkStyle = lk === "unit" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : lk === "purchaseUnit" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-sky-50 text-sky-700 border-sky-100";
                                    return (
                                      <div key={lk} className="flex items-center justify-center gap-1.5">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${lkStyle}`}>
                                          {lkName}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLink(item, lk)}
                                          className="p-0.5 hover:bg-rose-50 text-rose-500 rounded transition-colors cursor-pointer"
                                          title={`Remove ${lkName} linkage`}
                                        >
                                          <Unlink size={10} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </td>
                              )}
                              {linkedItemsModalType === "category" && (
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLink(item)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded border border-rose-100 text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer transition-all"
                                  >
                                    <Unlink size={10} /> Unlink
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowLinkedItemsModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
