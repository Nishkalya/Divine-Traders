import React, { useState } from "react";
import { ERPState, Party } from "../types";
import { formatINR, getVendorOutstanding, getCustomerOutstanding } from "../utils";
import { Plus, Search, Mail, Phone, MapPin, Building2, UserCheck, ShieldCheck, Edit2, Trash2, LayoutGrid, Table } from "lucide-react";

interface PartiesViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  prefillSearchTerm?: string;
  clearPrefill?: () => void;
}

export default function PartiesView({ state, onUpdateState, prefillSearchTerm, clearPrefill }: PartiesViewProps) {
  const [searchTerm, setSearchTerm] = useState(prefillSearchTerm || "");

  React.useEffect(() => {
    if (prefillSearchTerm) {
      setSearchTerm(prefillSearchTerm);
      if (clearPrefill) {
        clearPrefill();
      }
    }
  }, [prefillSearchTerm, clearPrefill]);
  const [filterType, setFilterType] = useState<"All" | "Customer" | "Vendor">("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isCreating, setIsCreating] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState<"Customer" | "Vendor" | "Both">("Customer");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [headOfficeAddress, setHeadOfficeAddress] = useState("");
  const [otherAddress, setOtherAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);

  const filteredParties = state.parties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm) ||
      (p.headOfficeAddress && p.headOfficeAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.otherAddress && p.otherAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.address && p.address.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter =
      filterType === "All" ||
      p.type === filterType ||
      p.type === "Both";

    return matchesSearch && matchesFilter;
  });

  const handleEditClick = (p: Party) => {
    setEditingParty(p);
    setName(p.name);
    setType(p.type);
    setEmail(p.email || "");
    setPhone(p.phone || "");
    setAddress(p.address || "");
    setHeadOfficeAddress(p.headOfficeAddress || "");
    setOtherAddress(p.otherAddress || "");
    setGstin(p.gstin || "");
    setOpeningBalance(p.openingBalance || 0);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingParty(null);
    setName("");
    setType("Customer");
    setEmail("");
    setPhone("");
    setAddress("");
    setHeadOfficeAddress("");
    setOtherAddress("");
    setGstin("");
    setOpeningBalance(0);
  };

  const handleSubmitParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert("Name is required.");
      return;
    }

    let updatedParties = [...state.parties];

    if (editingParty) {
      updatedParties = updatedParties.map((p) => {
        if (p.id === editingParty.id) {
          return {
            ...p,
            name,
            type,
            email,
            phone,
            address,
            headOfficeAddress,
            otherAddress,
            gstin: gstin.toUpperCase(),
            openingBalance,
          };
        }
        return p;
      });
    } else {
      const newParty: Party = {
        id: "p-" + Math.random().toString(36).substring(2, 9),
        name,
        type,
        email,
        phone,
        address,
        headOfficeAddress,
        otherAddress,
        gstin: gstin.toUpperCase(),
        openingBalance,
      };
      updatedParties.push(newParty);
    }

    onUpdateState({
      ...state,
      parties: updatedParties,
    });

    setIsCreating(false);
    setEditingParty(null);

    // Reset Form
    setName("");
    setType("Customer");
    setEmail("");
    setPhone("");
    setAddress("");
    setHeadOfficeAddress("");
    setOtherAddress("");
    setGstin("");
    setOpeningBalance(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Business Registry</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Accounts</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Parties Directory</h2>
        </div>
        {!isCreating && (
          <button
            onClick={() => {
              setEditingParty(null);
              setName("");
              setType("Customer");
              setEmail("");
              setPhone("");
              setAddress("");
              setHeadOfficeAddress("");
              setOtherAddress("");
              setGstin("");
              setOpeningBalance(0);
              setIsCreating(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm cursor-pointer border border-indigo-500"
          >
            <Plus size={16} /> Register New Party
          </button>
        )}
      </div>

      {/* Create Party Form */}
      {isCreating && (
        <form onSubmit={handleSubmitParty} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">
            {editingParty ? "Edit Customer / Vendor Account" : "Register Customer / Vendor Account"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Legal/Trade Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., Ambika Retailers"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Party Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none text-slate-700 font-semibold"
              >
                <option value="Customer">Customer (Buyer)</option>
                <option value="Vendor">Vendor (Supplier)</option>
                <option value="Both">Both (Dual Agent)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">GSTIN Identification Number</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                maxLength={15}
                placeholder="E.g., 27AAACR1234D1Z0"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E.g., info@tradebox.com"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="E.g., +91 9988771122"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Opening Account Balance (₹)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Billing / Branch Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Building Name, Street, Sector, City, State, ZIP Pin Code..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Head Office Address</label>
              <textarea
                rows={2}
                value={headOfficeAddress}
                onChange={(e) => setHeadOfficeAddress(e.target.value)}
                placeholder="Headquarters Building, Street, City, State, Country..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Other / Additional Address</label>
              <textarea
                rows={2}
                value={otherAddress}
                onChange={(e) => setOtherAddress(e.target.value)}
                placeholder="Godown / Warehouse / Secondary Address..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer border border-indigo-500"
            >
              {editingParty ? "Save Account Changes" : "Post Account Entry"}
            </button>
          </div>
        </form>
      )}

      {/* Directory Tab View */}
      {!isCreating && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1.5 border border-slate-200/60">
              <button
                onClick={() => setFilterType("All")}
                className={`px-3.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                  filterType === "All" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Parties ({state.parties.length})
              </button>
              <button
                onClick={() => setFilterType("Customer")}
                className={`px-3.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                  filterType === "Customer" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Customers ({state.parties.filter((p) => p.type === "Customer" || p.type === "Both").length})
              </button>
              <button
                onClick={() => setFilterType("Vendor")}
                className={`px-3.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                  filterType === "Vendor" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Vendors ({state.parties.filter((p) => p.type === "Vendor" || p.type === "Both").length})
              </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-300/60">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                    viewMode === "grid" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Grid Card View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                    viewMode === "table" ? "bg-white text-indigo-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Directory Table View"
                >
                  <Table size={14} />
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-600 focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Parties List View */}
          {filteredParties.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center italic">No parties found matching criteria.</p>
          ) : viewMode === "table" ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3.5">Party Name</th>
                      <th className="p-3.5">Type & GSTIN</th>
                      <th className="p-3.5">Contact Details</th>
                      <th className="p-3.5 text-right bg-emerald-50/50 text-emerald-800">Cust. Receivables</th>
                      <th className="p-3.5 text-right bg-rose-50/60 text-rose-800">Purchased Payment To Pay Amount</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredParties.map((p) => {
                      const isCustomer = p.type === "Customer" || p.type === "Both";
                      const isVendor = p.type === "Vendor" || p.type === "Both";
                      const vOutstanding = isVendor ? getVendorOutstanding(p.id, state) : 0;
                      const cOutstanding = isCustomer ? getCustomerOutstanding(p.id, state) : 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                            </div>
                            {p.headOfficeAddress && (
                              <p className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]" title={p.headOfficeAddress}>
                                HO: {p.headOfficeAddress}
                              </p>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border inline-block ${
                                p.type === "Both"
                                  ? "bg-purple-50 text-purple-700 border-purple-100"
                                  : p.type === "Vendor"
                                  ? "bg-amber-50 text-amber-700 border-amber-100"
                                  : "bg-blue-50 text-blue-700 border-blue-100"
                              }`}
                            >
                              {p.type}
                            </span>
                            {p.gstin && <p className="text-[10px] font-mono text-slate-500 mt-1">GSTIN: {p.gstin}</p>}
                          </td>
                          <td className="p-3.5 space-y-0.5 text-[11px]">
                            {p.phone && <p className="text-slate-700 font-medium">{p.phone}</p>}
                            {p.email && <p className="text-slate-400 font-mono text-[10px] truncate max-w-[160px]">{p.email}</p>}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold bg-emerald-50/20">
                            {isCustomer ? (
                              <span className={cOutstanding > 0 ? "text-emerald-700 font-extrabold" : "text-slate-400"}>
                                {formatINR(cOutstanding)}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold bg-rose-50/30">
                            {isVendor ? (
                              <span className={`px-2 py-1 rounded text-xs inline-block ${vOutstanding > 0 ? "bg-rose-100/80 text-rose-800 font-extrabold" : "text-slate-500"}`}>
                                {formatINR(vOutstanding)}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditClick(p)}
                                className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                                title="Edit Account Details"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${p.name}? This will remove the party from the directory.`)) {
                                    const updatedParties = state.parties.filter(party => party.id !== p.id);
                                    onUpdateState({ ...state, parties: updatedParties });
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                                title="Delete Party"
                              >
                                <Trash2 size={13} />
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParties.map((p) => {
                const isCustomer = p.type === "Customer" || p.type === "Both";
                const isVendor = p.type === "Vendor" || p.type === "Both";
                const vOutstanding = isVendor ? getVendorOutstanding(p.id, state) : 0;
                const cOutstanding = isCustomer ? getCustomerOutstanding(p.id, state) : 0;

                return (
                  <div
                    key={p.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Title & Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-sm tracking-tight">{p.name}</h4>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border inline-block ${
                              p.type === "Both"
                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                : p.type === "Vendor"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}
                          >
                            {p.type}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleEditClick(p)}
                            className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="Edit Account Details"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${p.name}? This will remove the party from the directory.`)) {
                                const updatedParties = state.parties.filter(party => party.id !== p.id);
                                onUpdateState({ ...state, parties: updatedParties });
                              }
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="Delete Party"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* GSTIN */}
                      {p.gstin && (
                        <p className="text-[10px] font-mono text-slate-400">
                          GSTIN: <span className="font-semibold text-slate-600">{p.gstin}</span>
                        </p>
                      )}

                      {/* Contacts list */}
                      <div className="text-xs text-slate-500 space-y-1.5 pt-1">
                        {p.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-400" />
                            <span>{p.phone}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-slate-400" />
                            <span className="truncate max-w-[200px]" title={p.email}>
                              {p.email}
                            </span>
                          </div>
                        )}
                        {p.address && (
                          <div className="flex items-start gap-2 pt-1">
                            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="whitespace-pre-line break-words text-slate-600 font-medium">{p.address}</span>
                          </div>
                        )}
                        {p.headOfficeAddress && (
                          <div className="flex items-start gap-2 pt-1">
                            <Building2 size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Head Office Address</span>
                              <span className="whitespace-pre-line break-words text-slate-600 font-medium">{p.headOfficeAddress}</span>
                            </div>
                          </div>
                        )}
                        {p.otherAddress && (
                          <div className="flex items-start gap-2 pt-1">
                            <MapPin size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Other / Additional Address</span>
                              <span className="whitespace-pre-line break-words text-slate-600 font-medium">{p.otherAddress}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Summary panel */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-mono">
                      {isCustomer && (
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-sans font-bold uppercase tracking-wider">Cust. Receivables</span>
                          <span className={`font-bold mt-0.5 ${cOutstanding > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            {formatINR(cOutstanding)}
                          </span>
                        </div>
                      )}
                      {isVendor && (
                        <div className="flex flex-col text-right ml-auto bg-rose-50/70 p-2 rounded-xl border border-rose-100/80">
                          <span className="text-[9px] text-rose-800 font-sans font-extrabold uppercase tracking-wider">Purchased Payment To Pay</span>
                          <span className={`font-black mt-0.5 text-sm ${vOutstanding > 0 ? "text-rose-600" : "text-slate-500"}`}>
                            {formatINR(vOutstanding)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
