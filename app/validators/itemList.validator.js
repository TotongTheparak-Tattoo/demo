class ItemListUploadValidator {
    constructor(options = {}) {
        this.REQUIRED_HEADERS = options.requiredHeaders || [
            "Zone",
            "Vendor Code",
            "Vendor Name",
            "Manufacture",
            "Spec",
            "Dia",
            "Length",
            "Size",
            "L",
            "W",
            "H",
            "Weight",
            "Sub location",
        ];

        this.aliasMap = {
            "Zone": ["zone"],
            "Vendor Code": ["vendorcode", "vendorco", "vendorcd", "vendercode", "code"],
            "Vendor Name": ["vendorname", "vendornm", "vendorna", "vendername", "name", "vendor"],
            "Manufacture": ["manufacture", "manufacturer", "mfr", "maker", "brand", "manufactu"],
            "Spec": ["spec", "specification", "grade", "specs"],
            "Dia": ["dia", "diameter", "ø", "phi"],
            "Length": ["length", "len", "lngth"],
            "Size": ["size"],
            "L": ["l"],
            "W": ["w", "width"],
            "H": ["h", "height"],
            "Weight": ["weight", "wt", "kg", "mass"],
            "Sub location": ["sublocation", "subloc", "sub_loc", "sub-loc", "sub location", "subbay", "sub bay"],
            ...(options.aliasMap || {}),
        };
    }

    norm(s = "") {
        return String(s).toLowerCase().replace(/[\s_\-().]/g, "");
    }

    mapHeaderToStandard(h) {
        const n = this.norm(h);
        for (const std of this.REQUIRED_HEADERS) if (this.norm(std) === n) return std;
        for (const std of this.REQUIRED_HEADERS) {
            const aliases = this.aliasMap[std] || [];
            for (const a of [std, ...aliases]) {
                const na = this.norm(a);
                if (n === na || n.startsWith(na) || na.startsWith(n)) return std;
            }
        }
        return null;
    }

    httpError(status, message, payload = {}) {
        const e = new Error(message);
        e.status = status;
        e.body = { message, result: payload };
        return e;
    }

    validateAndNormalize(headers, rows) {
        if (!Array.isArray(headers) || !Array.isArray(rows)) {
            throw this.httpError(400, "Invalid payload", { message: "headers and rows must be arrays" });
        }

        const rawHeaders = headers.map((h) => String(h || "").trim());
        const headerMap = {}; // raw -> std
        const stdSeen = new Set();
        const unknown = [];

        for (const h of rawHeaders) {
            const std = this.mapHeaderToStandard(h);
            if (std && !stdSeen.has(std)) {
                headerMap[h] = std;
                stdSeen.add(std);
            } else if (!std) {
                unknown.push(h);
            }
        }

        const missing = this.REQUIRED_HEADERS.filter((h) => !stdSeen.has(h));
        if (missing.length > 0) {
            throw this.httpError(400, "Missing required headers", {
                message: "CSV/Excel headers incomplete",
                details: missing.map((m) => ({ field: m })),
                unknownHeaders: unknown,
            });
        }

        // ทำ stdRow (ชื่อหัวตามมาตรฐาน) → แล้ว re-key เป็นคีย์ที่ service ต้องการ (ชื่อตาม DB input)
        const stdRows = rows.map((r) => {
            const o = {};
            for (const [raw, std] of Object.entries(headerMap)) o[std] = r[raw];
            return o;
        });

        const normalizedRows = stdRows.map((r) => ({
            zone: String(r["Zone"] ?? "").trim(),
            vendorMasterCode: String(r["Vendor Code"] ?? "").trim(),
            manufacture: String(r["Manufacture"] ?? "").trim(),

            spec: String(r["Spec"] ?? "").trim(),
            dia: String(r["Dia"] ?? ""),
            length: String(r["Length"] ?? ""),
            size: String(r["Size"] ?? "").trim(),
            l: r["L"] === "" || r["L"] == null ? null : Number(r["L"]),
            w: r["W"] === "" || r["W"] == null ? null : Number(r["W"]),
            h: r["H"] === "" || r["H"] == null ? null : Number(r["H"]),
            subLocation: r["Sub location"] === "" || r["Sub location"] == null ? null : Number(r["Sub location"]),
            weight: r["Weight"] === "" || r["Weight"] == null ? null : Number(r["Weight"]),
        }));

        return { normalizedRows, headerMap, requiredHeaders: this.REQUIRED_HEADERS };
    }
}

// export instance ใช้งานสะดวกใน controller
module.exports = new ItemListUploadValidator();
// ถ้าต้องการ new เองภายนอก ก็ส่ง class ออกด้วย:
// module.exports.ItemListUploadValidator = ItemListUploadValidator;
