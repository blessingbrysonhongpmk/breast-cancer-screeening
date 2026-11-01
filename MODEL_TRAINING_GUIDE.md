# Model Training & Evaluation Guide

**Platform:** MammoFusion-XAI  
**Framework:** PyTorch 2.2+, Torchvision  
**Architectures:** Unimodal ResNet-50 for Digital Mammography & Infrared Thermography  
**Explainability:** Grad-CAM via `layer4` Bottleneck Gradient Backpropagation  

---

## 1. Deep Learning Architectures

MammoFusion-XAI uses distinct deep convolutional neural network pipelines for each imaging modality, tailored to the unique spatial characteristics and color spaces of mammograms vs thermograms.

```
       [ Input Image ]
             │
      ┌──────┴──────┐
      │             │
 [Mammogram]    [Thermal]
 (1x224x224)   (3x224x224)
      │             │
  ResNet-50     ResNet-50
 (layer1..4)   (layer1..4)
      │             │
      └──────┬──────┘
             │
   AdaptiveAvgPool2d
             │
     Linear(2048, 3)  --> Softmax --> [Normal, Benign, Malignant]
             │
       Backprop Grad
             │
      Grad-CAM Map    --> Turbo Color Overlay + ROI Bounding Box
```

### 1.1 Mammogram Classifier (`src/mammogram/model.py`)
- **Input:** Single-channel grayscale expanded to 3 channels for standard ImageNet backbone compatibility ($224 \times 224 \times 3$).
- **Backbone:** ResNet-50 with pretrained weights on natural images, fine-tuned with adaptive learning rates.
- **Preprocessing:** Bilinear interpolation with aspect-ratio preservation, zero-padding, and min-max normalization.
- **Output:** 3 logits corresponding to `normal` (0), `benign` (1), and `malignant` (2).

### 1.2 Thermal Classifier (`src/thermal/model.py`)
- **Input:** Native 3-channel RGB thermograms ($224 \times 224 \times 3$). Preserves false-color radiometric heat distributions.
- **Backbone:** ResNet-50.
- **Preprocessing:** Standard ImageNet channel-wise normalization (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`).
- **Output:** 3 logits corresponding to `normal` (0), `benign` (1), and `malignant` (2).

---

## 2. Patient-Level Data Partitioning (Zero Leakage)

To guarantee reliable generalization and prevent data leakage:
- **Rule:** Images from the same patient or participant are NEVER split across train, validation, and test sets.
- **Mammography (MIAS):** 161 unique patients partitioned at patient ID boundary:
  - **Train:** 111 patients (221 images)
  - **Validation:** 24 patients (48 images)
  - **Held-Out Test:** 26 patients (48 images)
- **Thermography (Mendeley):** 119 unique participants partitioned at participant folder boundary:
  - **Train:** 79 participants (237 images)
  - **Validation:** 20 participants (51 images)
  - **Held-Out Test:** 20 participants (48 images)

---

## 3. Training Scripts & Execution

### 3.1 Training the Mammogram Model

```bash
py -3.10 -m src.mammogram.train \
    --data-dir data/raw/mammogram \
    --manifest data/manifests/mammogram_manifest.csv \
    --epochs 30 \
    --batch-size 16 \
    --learning-rate 0.0001 \
    --output-model models/mammogram_resnet50.pt
```

### 3.2 Training the Thermal Model

```bash
py -3.10 -m src.thermal.train \
    --data-dir data/raw/thermal \
    --manifest data/manifests/thermal_manifest.csv \
    --epochs 30 \
    --batch-size 16 \
    --learning-rate 0.0001 \
    --output-model models/thermal_resnet50.pt
```

### 3.3 Loss Function & Class Imbalance Handling
Because medical screening datasets exhibit class imbalance, training employs weighted cross-entropy:
$$\mathcal{L}_{CE} = - \sum_{c=1}^C w_c \cdot y_c \log(\hat{y}_c)$$
where weights $w_c$ are inversely proportional to class frequencies in the training partition.

---

## 4. Model Evaluation & Benchmark Generation

After training, evaluate the models on the unseen, patient-isolated held-out test splits:

```bash
py -3.10 -m src.evaluation.evaluate_all \
    --mammogram-model models/mammogram_resnet50.pt \
    --thermal-model models/thermal_resnet50.pt \
    --output-report reports/evaluation_results.json
```

### Key Metrics Recorded
- **Overall Accuracy:** Percentage of correct diagnostic predictions across all test cases.
- **Macro Precision:** Unweighted mean positive predictive value across classes.
- **Macro Recall / Sensitivity:** Unweighted mean true positive rate.
- **Macro Specificity:** Unweighted mean true negative rate.
- **Macro F1-Score:** Harmonic mean of precision and recall.
- **Macro ROC-AUC:** Area Under the Receiver Operating Characteristic Curve.
- **Per-Class Metrics & Confusion Matrix:** Full $3 \times 3$ contingency tables.

---

## 5. Explainable AI: Grad-CAM Implementation

Grad-CAM (`src/explainability/gradcam.py`) computes importance weights $\alpha_k^c$ by global-average-pooling gradients with respect to convolutional activations $A^k$ at `layer4`:

$$\alpha_k^c = \frac{1}{Z} \sum_{i} \sum_{j} \frac{\partial Y^c}{\partial A_{i,j}^k}$$

$$L_{\text{Grad-CAM}}^c = \text{ReLU}\left(\sum_k \alpha_k^c A^k\right)$$

- **ReLU Rectification:** Isolates features positively contributing to the chosen diagnostic class.
- **Colormap Overlay:** Uses OpenCV and Matplotlib Turbo colormap for perceptually uniform contrast without misleading rainbow artifacts.
- **Focal Region Localization:** Thresholds top activations ($\ge 60\%$) to generate bounding boxes indicating anatomical regions of concern.

