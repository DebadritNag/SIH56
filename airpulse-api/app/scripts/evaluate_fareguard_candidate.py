"""Evaluate a separate candidate from a saved genuine-data snapshot; never activate."""
import argparse
import json
from pathlib import Path
from app.ml.fareguard import FareGuardModel
from app.ml.live_inference import load_active
from app.ml.fareguard_candidate import evaluate_candidate


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',required=True)
    parser.add_argument('--output-dir',default='models/candidates')
    args=parser.parse_args()
    baseline=load_active(dict(version='fareguard-xgb-v1',artifact_storage_path='fareguard-xgb-v1.joblib',feature_schema={'features':FareGuardModel.FEATURE_COLS}),'fareguard')
    result=evaluate_candidate(json.loads(Path(args.snapshot).read_text(encoding='utf-8')),baseline,args.output_dir)
    print(json.dumps({k:v for k,v in result.items() if k!='live_predictions'},indent=2))


if __name__=='__main__':
    main()
