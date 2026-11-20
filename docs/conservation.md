# Gold Conservation Engine & Pure Arithmetic Specification

## 1. Physical Principle: Conservation of Mass
Gold is an indestructible noble metal; during traditional jewellery craftsmanship (*job-work*), gold is strictly conserved. It does not vanish into thin air. Every milligram becomes one of four distinct states:
1. **Finished Jewellery Pieces** returned to the jeweller.
2. **Agreed Workshop Wastage** (*ghat* / filing loss) agreed before gold issuance.
3. **Recovered Workshop Scrap** (*chhilka* / polishing dust / sweepings) returned directly or assayed via refiner.
4. **Unexplained Shortfall / Gap**, which must be accounted for mathematically.

---

## 2. Fine-Gold Normalization Formula
Because the purity (karat) of issued raw bullion and returned pieces may vary (e.g. solder alloys used during fabrication), all accounting equations normalize raw weights to **Fine-Gold Equivalents**:

$$w_{\text{fine}} = \text{Round}\left(w_{\text{raw}} \times \frac{\text{Karat}}{24}, 4\right)$$

- Internal calculations use standard 4 decimal places (`0.0001` g = `0.1` mg) with `ROUND_HALF_UP`.
- Implemented in `core_engine/purity.py` using Python `Decimal`.

---

## 3. The Core Conservation Equation

$$\text{Issued Fine Gold} = \text{Returned Fine Gold} + \text{Agreed Wastage} + \text{Recovered Scrap} + \text{Unexplained Gap}$$

From this, the system isolates two key metrics:

### 3.1 Gap to Explain
$$\text{Gap to Explain} = \text{Issued Fine Gold} - \text{Returned Fine Gold}$$

### 3.2 Unexplained Gap
$$\text{Unexplained Gap} = \text{Gap to Explain} - \text{Agreed Wastage} - \text{Recovered Scrap}$$

---

## 4. Reconciliation Status Classifications

| Status | Mathematical Condition | Explanation |
| :--- | :--- | :--- |
| **`BALANCED`** | $\text{Unexplained Gap} = 0.0000\text{ g}$ | Every gram accounted for with zero discrepancy. |
| **`WITHIN_TOLERANCE`** | $0 < \text{Unexplained Gap} \le \text{Tolerance}$ | Normal variance within the shop's agreed threshold (`0.20 g` default). |
| **`REVIEW`** | $\text{Unexplained Gap} > \text{Tolerance}$ | Discrepancy exceeds tolerance band. Flagged as a question for mutual review with scale photos (never an accusation of theft). |
| **`NEGATIVE_GAP`** | $\text{Unexplained Gap} < 0.0000\text{ g}$ | More gold was returned/recovered than originally issued. Prompts verification of scale tare or karat inputs. |

---

## 5. Handbook Worked Example

```
Issued Fine Gold:     50.00 g (22K)
Returned Pieces:      47.10 g (22K)
Agreed Wastage (2%):   1.00 g
Recovered Scrap:       1.45 g

Gap to Explain:       50.00 - 47.10 = 2.90 g
Unexplained Gap:       2.90 - 1.00 - 1.45 = 0.45 g
Tolerance:             0.20 g

Status:               REVIEW (Unexplained gap 0.45 g > 0.20 g tolerance)
```
Line-by-line breakdown generated:
- `Issued (fine): 50.00 g`
- `Returned (fine): 47.10 g`
- `Gap to explain: 2.90 g`
- `Agreed wastage (2.0%): 1.00 g`
- `Recovered scrap: 1.45 g`
- `Unexplained gap: 0.45 g [REVIEW]`
