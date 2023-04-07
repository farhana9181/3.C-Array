#include <iostream>
using namespace std;
int main()
{
    int m;
    cout<<"Input Mark =" ;
    cin>>m;

    switch(m>=0 && m<=100)
    {
    case 1:
        switch(m/10)
        {
        case 10:
        case 9:
            cout<<" ** A GRADE for "<<m<<".";
            break;
        case 8:
            switch(m%10)
            {
            case 9:
            case 8:
            case 7:
                cout<<" ** B+ GRADE for "<<m<<".";
                break;
            case 6:
            case 5:
            case 4:
                cout<<" ** B GRADE for "<<m<<".";
                break;
            case 3:
            case 2:
            case 1:
            case 0:
                cout<<" ** B- GRADE for "<<m<<".";
                break;
            }
            break;
        case 7:
            switch(m%10)
            {
            case 9:
            case 8:
            case 7:
                cout<<" ** C+ GRADE for "<<m<<".";
                break;
            case 6:
            case 5:
            case 4:
                cout<<" ** C GRADE for "<<m<<".";
                break;
            case 3:
            case 2:
            case 1:
            case 0:
                cout<<" ** C- GRADE for "<<m<<".";
                break;
            }
            break;
        case 6:
            switch(m%10)
            {
            case 9:
            case 8:
            case 7:
            case 6:
            case 5:
                cout<<" ** D+ GRADE for "<<m<<".";
                break;
            case 4:
            case 3:
            case 2:
            case 1:
            case 0:
                cout<<" ** D GRADE for "<<m<<".";
                break;
            }
            break;
        default:
            cout<<" ** F GRADE for "<<m<<".";
        }
        break;
    default:
        cout<<" ** Invalid marks for "<<m<<".";
    }
}
