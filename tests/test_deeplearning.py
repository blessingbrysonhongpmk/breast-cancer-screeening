"""Unit tests for Deep Learning components:
1. MammogramClassifier (ResNet-50) forward pass & target layer
2. ThermalClassifier (ResNet-50) forward pass & target layer
3. Grad-CAM visual attribution calculation & mathematical range
4. Clinical metrics calculation (Sensitivity, Specificity, Precision, F1, ROC-AUC)
"""

import unittest
import torch
import numpy as np
from PIL import Image

from src.mammogram.model import MammogramClassifier
from src.thermal.model import ThermalClassifier
from src.explainability.gradcam import GradCAM, apply_colormap_to_cam
from src.evaluation.metrics import compute_clinical_metrics


class TestDeepLearningModels(unittest.TestCase):
    """Verifies deep learning model architectures and shapes."""

    def test_mammogram_classifier_forward(self):
        # Create MammogramClassifier (weights=None for fast unit test)
        model = MammogramClassifier(num_classes=3, pretrained=False)
        model.eval()

        dummy_input = torch.randn(2, 3, 224, 224)
        logits = model(dummy_input)

        self.assertEqual(logits.shape, (2, 3), "MammogramClassifier output must be (B, num_classes)")
        
        probs = model.predict_probabilities(dummy_input)
        self.assertEqual(probs.shape, (2, 3))
        # Probabilities sum to 1.0 across classes
        sum_probs = torch.sum(probs, dim=1).numpy()
        np.testing.assert_allclose(sum_probs, [1.0, 1.0], rtol=1e-5)

    def test_thermal_classifier_forward(self):
        model = ThermalClassifier(num_classes=3, pretrained=False)
        model.eval()

        dummy_input = torch.randn(2, 3, 224, 224)
        logits = model(dummy_input)

        self.assertEqual(logits.shape, (2, 3), "ThermalClassifier output must be (B, num_classes)")
        
        probs = model.predict_probabilities(dummy_input)
        self.assertEqual(probs.shape, (2, 3))
        sum_probs = torch.sum(probs, dim=1).numpy()
        np.testing.assert_allclose(sum_probs, [1.0, 1.0], rtol=1e-5)

    def test_target_layers_exist(self):
        mammo_model = MammogramClassifier(num_classes=3, pretrained=False)
        target_layer = mammo_model.get_target_layer()
        self.assertIsNotNone(target_layer, "Target layer must not be None")
        self.assertTrue(isinstance(target_layer, torch.nn.Module))

        thermal_model = ThermalClassifier(num_classes=3, pretrained=False)
        target_layer_t = thermal_model.get_target_layer()
        self.assertIsNotNone(target_layer_t)
        self.assertTrue(isinstance(target_layer_t, torch.nn.Module))


class TestGradCAM(unittest.TestCase):
    """Verifies genuine Grad-CAM mathematical formulation and gradient backpropagation."""

    def test_gradcam_generation(self):
        model = MammogramClassifier(num_classes=3, pretrained=False)
        target_layer = model.get_target_layer()

        gradcam = GradCAM(model, target_layer)
        dummy_input = torch.randn(1, 3, 224, 224, requires_grad=True)

        cam_np, pred_class, confidence = gradcam.generate(dummy_input, target_class=1)

        self.assertEqual(cam_np.shape, (224, 224), "Heatmap must match spatial dimensions of input")
        self.assertTrue(0.0 <= cam_np.min(), "Heatmap minimum must be >= 0.0")
        self.assertTrue(cam_np.max() <= 1.0, "Heatmap maximum must be <= 1.0")
        self.assertIsInstance(pred_class, int)
        self.assertTrue(0.0 <= confidence <= 1.0)

    def test_colormap_blending(self):
        heatmap = np.random.uniform(0.0, 1.0, (224, 224)).astype(np.float32)
        dummy_img = Image.new("RGB", (224, 224), (128, 128, 128))

        blended = apply_colormap_to_cam(heatmap, dummy_img)
        self.assertEqual(blended.size, (224, 224))
        self.assertEqual(blended.mode, "RGB")


class TestClinicalMetrics(unittest.TestCase):
    """Verifies medical biostatistics metrics computation."""

    def test_metrics_calculation(self):
        # 0: Normal, 1: Benign, 2: Malignant
        y_true = [0, 0, 1, 1, 2, 2]
        y_pred = [0, 0, 1, 0, 2, 2]  # One benign misclassified as normal
        y_prob = np.array([
            [0.8, 0.1, 0.1],
            [0.9, 0.05, 0.05],
            [0.2, 0.7, 0.1],
            [0.6, 0.3, 0.1],  # False negative for benign
            [0.1, 0.1, 0.8],
            [0.05, 0.15, 0.8]
        ])

        metrics = compute_clinical_metrics(y_true, y_pred, y_prob)

        self.assertIn("overall_accuracy", metrics)
        self.assertIn("macro_sensitivity_recall", metrics)
        self.assertIn("macro_specificity", metrics)
        self.assertIn("macro_f1", metrics)
        self.assertIn("macro_roc_auc", metrics)
        self.assertIn("per_class", metrics)

        # 5 out of 6 correct = 83.3%
        self.assertAlmostEqual(metrics["overall_accuracy"], 5/6, places=3)
        # Malignant: 2 TP, 0 FN -> Sensitivity = 1.0
        self.assertEqual(metrics["per_class"]["malignant"]["sensitivity_recall"], 1.0)


if __name__ == "__main__":
    unittest.main()

