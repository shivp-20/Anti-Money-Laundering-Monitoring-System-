# 🚨 AML Graph Intelligence System

### *End-to-End Anti–Money Laundering Detection using Graph Neural Networks*

---

## 📌 Project Overview

This project presents an **end-to-end Anti–Money Laundering (AML) detection system** that leverages **graph analytics, Graph Neural Networks (GNNs), and explainable AI techniques** to identify suspicious financial behavior in transaction data.

Unlike traditional rule-based AML systems, this project models **transaction flows as a graph**, enabling the detection of complex laundering patterns such as:

- Fan-in / Fan-out money movement  
- Circular (layering) transactions  
- Suspicious behavioral clusters  

The system is designed using **Apache Spark**, **GraphFrames**, **PyTorch Geometric**, and **LLM-based report generation**, making it scalable, explainable, and close to real-world AML pipelines.

---

## 🧠 Key Features

- Distributed data processing with **Apache Spark**  
- Graph construction from raw transaction logs  
- Detection of suspicious patterns (fan-in, fan-out, cycles)  
- GNN-based risk scoring for accounts  
- Automatic Suspicious Activity Report (SAR) generation  
- Visual analytics of transaction networks  

---
## 🧩 System Architecture

- **Raw Transactions**
  - Data Cleaning & Parsing (Spark)
    - Graph Construction (GraphFrames)
      - Pattern Detection (Fan-in / Fan-out / Cycles)
        - Graph Neural Network (GCN)
          - Risk Scoring
            - SAR Generation (LLM)





## ⚙️ Technologies Used

| Component       | Technology                 |
|-----------------|----------------------------|
| Data Processing | Apache Spark               |
| Graph Analytics | GraphFrames                |
| Deep Learning   | PyTorch, PyTorch Geometric |
| NLP / Reports   | LangChain, HuggingFace     |
| Visualization   | NetworkX, Matplotlib       |
| Language        | Python                     |

---

## 🔬 Pipeline Summary

1. **Data Ingestion** – Transactional CSV files are ingested and cleaned using Spark.  
2. **Graph Construction** – Accounts become nodes, transactions become directed edges.  
3. **Pattern Detection** – Graph algorithms detect fan-in, fan-out, and circular flows.  
4. **Risk Scoring** – A Graph Convolutional Network assigns a risk score to each account.  
5. **SAR Generation** – High-risk accounts are passed to an LLM to generate audit-ready reports.  

---

## 📊 Model Evaluation

Performance is measured using:  
- Accuracy  
- Precision  
- Recall  
- F1-score  

Evaluation is based on labeled suspicious accounts derived from known laundering patterns.

---


