#include <iostream>
using namespace std;
int main ()
{
    int n[3],i,j,asc;
    cout<<"Enter two numbers ="<<endl;
    for(i=0; i<3; i++)
    {
        cout<<"n["<<i<<"] =";
        cin>> n[i];
    }
    cout<< "**Ascending order **=  "<< endl;
    for(i=0; i<3; i++)
    {
        for (j=0; j<3; j++)
        {
            if(n[i]>n[j])
            {
                asc=n[i];
                n[i]=n[j];
                n[j]=asc;
            }
        }
    }
    for(i=0; i<3; i++)
    {
        cout<<n[i]<<"\t" ;
    }

    cout<<endl<< "**Descending order **=  "<<endl;
    for(i=0; i<3; i++)
    {
        for (j=0; j<3; j++)
        {
            if(n[i]<n[j])
            {
                asc=n[i];
                n[i]=n[j];
                n[j]=asc;
            }
        }
    }
    for(i=0; i<3; i++)
    {
        cout<<n[i] <<"\t" ;
    }

    return 0;

}


